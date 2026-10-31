import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from './app';
import { IDatabase, ILLMProvider, Message } from '../../src/raven-integration/ravenChat';

class MockDB implements IDatabase {
  public messages: Message[] = [];
  async saveMessage(msg: Message) { this.messages.push(msg); }
  async updateMessageStatus(id: string, status: 'success' | 'failed', content?: string) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.status = status;
      if (content !== undefined) msg.content = content;
    }
  }
  async getHistory(sessionId: string) {
    return this.messages.filter(m => m.sessionId === sessionId && m.status === 'success');
  }
}

class MockLLM implements ILLMProvider {
  public delayMs = 0;
  async generateResponse(history: Message[], systemPrompt: string) {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
    return "This is a <script>alert('safe')</script> response.";
  }
}

describe('RAVEN Chat API Endpoint', () => {
  let db: MockDB;
  let llm: MockLLM;
  let app: any;

  beforeEach(() => {
    db = new MockDB();
    llm = new MockLLM();
    app = createApp(db, llm);
  });

  it('should process a valid chat request successfully', async () => {
    const response = await request(app)
      .post('/api/raven/chat')
      .send({
        playerId: 'player1',
        sessionId: 'sessionA',
        message: 'Hello server',
        fingerprint: 'device-123'
      });

    expect(response.status).toBe(200);
    expect(response.body.message.status).toBe('success');
    expect(response.body.message.content).toBe('This is a &lt;script&gt;alert(&#039;safe&#039;)&lt;/script&gt; response.');
  });

  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/raven/chat')
      .send({
        playerId: 'player1',
        // missing sessionId and message
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing required fields (playerId, sessionId, message)');
  });

  it('should prevent concurrent requests for the same session (429)', async () => {
    // Add artificial delay to LLM to keep the lock held
    llm.delayMs = 200;

    // Fire two requests simultaneously
    const req1 = request(app)
      .post('/api/raven/chat')
      .send({ playerId: 'player1', sessionId: 'sessionA', message: 'Hello 1' });

    const req2 = request(app)
      .post('/api/raven/chat')
      .send({ playerId: 'player1', sessionId: 'sessionA', message: 'Hello 2' });

    const [res1, res2] = await Promise.all([req1, req2]);

    // One should succeed, one should hit the concurrency lock
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 429]);
  });

  it('should return 500 when LLM generation fails', async () => {
    llm.generateResponse = vi.fn().mockRejectedValue(new Error("API Timeout"));

    const response = await request(app)
      .post('/api/raven/chat')
      .send({
        playerId: 'player1',
        sessionId: 'sessionA',
        message: 'Fail me'
      });

    expect(response.status).toBe(500);
    expect(response.body.message.status).toBe('failed');
    expect(response.body.message.content).toContain('System error');
  });
});
