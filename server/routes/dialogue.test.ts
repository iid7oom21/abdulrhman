import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cors from 'cors';
import { Router } from 'express';
import { DialogueService } from '../services/dialogueService';
import { MockGroqAdapter } from '../adapters/MockGroqAdapter';
import { MockPostgresAdapter } from '../adapters/MockPostgresAdapter';
import { dialogueRouter } from './dialogue';

function createTestApp(db: MockPostgresAdapter, llm: MockGroqAdapter) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const router = Router();
  const service = new DialogueService(db, llm);

  router.post('/dialogue', async (req, res) => {
    try {
      const response = await service.handleDialogue(req.body);

      if (response.status === 'cannot_verify') return res.status(503).json(response);
      if (response.status === 'unknown') return res.status(502).json(response);
      if (response.status === 'failed') return res.status(500).json(response);
      if (response.status === 'in_progress_or_stuck') return res.status(202).json(response);
      if (response.status === 'concurrent_conflict') return res.status(409).json(response);

      return res.status(200).json(response);
    } catch (e) {
      return res.status(500).json({ error: 'Fatal' });
    }
  });

  app.use('/api', router);
  return app;
}

describe('RAVEN Strict Dialogue Logic', () => {
  let db: MockPostgresAdapter;
  let llm: MockGroqAdapter;
  let app: express.Express;

  beforeEach(() => {
    db = new MockPostgresAdapter();
    llm = new MockGroqAdapter();
    app = createTestApp(db, llm);
  });

  const baseReq = { playerId: 'p1', sessionId: 's1', message: 'Hello', character: 'jonas', requestId: 'req_1' };

  it('1. should process success, include context, and sanitize output', async () => {
    const res = await request(app).post('/api/dialogue').send(baseReq);
    expect(res.status).toBe(200);
    expect(res.body.message.status).toBe('success');
    expect(res.body.message.content).toContain('Last msg: Hello');
    expect(res.body.message.content).toContain('&lt;script&gt;');
    expect(llm.globalCallCounter).toBe(1);
  });

  it('2. Rule 1 & 3: DB Read failure blocks processing (cannot_verify)', async () => {
    db.failDbRead = true;
    const res = await request(app).post('/api/dialogue').send(baseReq);
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('cannot_verify');
    expect(llm.globalCallCounter).toBe(0);
  });

  it('3. Rule 2 & 4: Definitive failure marks as failed (proof)', async () => {
    llm.definitiveFailure = true;
    const res = await request(app).post('/api/dialogue').send(baseReq);
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('failed');

    const ast = db.messages.find(m => m.role === 'assistant');
    expect(ast?.status).toBe('failed');
    expect(llm.globalCallCounter).toBe(1);
  });

  it('4. Rule 2: Unknown failure (timeout) marks as unknown', async () => {
    llm.unknownFailure = true;
    const res = await request(app).post('/api/dialogue').send(baseReq);
    expect(res.status).toBe(502);
    expect(res.body.status).toBe('unknown');

    const ast = db.messages.find(m => m.role === 'assistant');
    expect(ast?.status).toBe('unknown');
    expect(llm.globalCallCounter).toBe(1);
  });

  it('5. Rule 2 & 5: LLM succeeds but DB save fails -> unknown state returned to client', async () => {
    db.failSuccessSave = true;
    const res = await request(app).post('/api/dialogue').send(baseReq);
    expect(res.status).toBe(502);
    expect(res.body.status).toBe('unknown');
    expect(llm.globalCallCounter).toBe(1);
  });

  it('6. Rule 3: Retrieval of a stuck reserved/calling state returns 202 without regenerating', async () => {
    db.messages.push({
        id: 'msg_stuck', requestId: 'req_stuck', sessionId: 's1', playerId: 'p1',
        character: 'jonas', role: 'assistant', content: '', status: 'calling', timestamp: Date.now()
    });
    const res = await request(app).post('/api/dialogue').send({ ...baseReq, requestId: 'req_stuck' });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('in_progress_or_stuck');
    expect(llm.globalCallCounter).toBe(0);
  });

  it('7. Rule 6: Simulating a process crash after reserving, counter remains 0 outside', async () => {
    db.failCallingUpdate = true;
    const res = await request(app).post('/api/dialogue').send(baseReq);
    expect(res.status).toBe(503);

    const ast = db.messages.find(m => m.role === 'assistant');
    expect(ast?.status).toBe('reserved');
    expect(llm.globalCallCounter).toBe(0);
  });

  it('8. Atomic concurrency locking (409)', async () => {
    llm.delayMs = 150;

    // First req acquires lock
    const p1 = request(app).post('/api/dialogue').send({ ...baseReq, requestId: 'rA' });
    await new Promise(r => setTimeout(r, 10)); // Ensure lock registered
    // Second req attempts same session
    const p2 = request(app).post('/api/dialogue').send({ ...baseReq, requestId: 'rB' });

    const [res1, res2] = await Promise.all([p1, p2]);
    const statuses = [res1.status, res2.status].sort();

    expect(statuses).toEqual([200, 409]);
    expect(llm.globalCallCounter).toBe(1); // LLM only called once
  });
});
