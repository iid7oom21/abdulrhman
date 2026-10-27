import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app;
let db;

before(async () => {
  process.env.CONFIG = path.join(__dirname, '../config.example.json');
  process.env.NODE_ENV = 'test';
  const cfg = JSON.parse(fs.readFileSync(process.env.CONFIG, 'utf8'));
  if (fs.existsSync(cfg.dbPath)) fs.unlinkSync(cfg.dbPath);
  const mod = await import('../src/index.js');
  app = mod.app;
  db = mod.db;
});

after(() => {
  try { db.close(); } catch {}
});

describe('Credit system simulation', () => {
  it('lists packages with cost estimate', async () => {
    const res = await request(app).get('/packages');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    assert.ok(res.body[0].estimatedCost);
  });

  it('creates payment intent and prevents double creation with same idempotency key', async () => {
    const key = 'test-idem-' + Date.now();
    const res1 = await request(app).post('/payments/create').send({
      userId: 'user1',
      packageId: 'pack_small',
      idempotencyKey: key
    });
    assert.equal(res1.status, 200);
    const paymentId = res1.body.payment.id;

    const res2 = await request(app).post('/payments/create').send({
      userId: 'user1',
      packageId: 'pack_small',
      idempotencyKey: key
    });
    assert.equal(res2.body.existing, true);
  });

  it('rejects webhook with bad signature', async () => {
    const res = await request(app).post('/webhooks/payment')
      .set('x-sim-signature', 'bad')
      .send({ paymentId: 'none', amount: 1, currency: 'SAR', status: 'paid' });
    assert.equal(res.status, 401);
  });

  it('credits only once on repeated valid webhook', async () => {
    const key = 'once-' + Date.now();
    const create = await request(app).post('/payments/create').send({
      userId: 'user2',
      packageId: 'pack_small',
      idempotencyKey: key
    });
    const paymentId = create.body.payment.id;

    const sim = await request(app).post('/simulation/pay').send({ paymentId });
    const { payload, signature } = sim.body;

    const w1 = await request(app).post('/webhooks/payment')
      .set('x-sim-signature', signature)
      .send(payload);
    assert.equal(w1.status, 200);
    assert.ok(w1.body.credited > 0);

    const w2 = await request(app).post('/webhooks/payment')
      .set('x-sim-signature', signature)
      .send(payload);
    assert.equal(w2.body.alreadyProcessed, true);

    const credit = await request(app).get('/credits/user2');
    assert.equal(credit.body.balance_messages, 20);
  });

  it('falls back to written mode when credit is depleted', async () => {
    const res = await request(app).post('/dialogue').send({
      userId: 'user3',
      caseId: 'on-the-other-side',
      message: 'من الفاعل؟',
      preferAi: true
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.mode, 'written');
  });

  it('consumes credit for AI dialogue and keeps progress', async () => {
    const key = 'consume-' + Date.now();
    const create = await request(app).post('/payments/create').send({
      userId: 'user4',
      packageId: 'pack_small',
      idempotencyKey: key
    });
    const paymentId = create.body.payment.id;
    const sim = await request(app).post('/simulation/pay').send({ paymentId });
    await request(app).post('/webhooks/payment')
      .set('x-sim-signature', sim.body.signature)
      .send(sim.body.payload);

    const d1 = await request(app).post('/dialogue').send({
      userId: 'user4',
      caseId: 'on-the-other-side',
      message: 'ما الدليل على كسر الباب؟',
      preferAi: true
    });
    assert.equal(d1.body.mode, 'ai');
    assert.equal(d1.body.remaining, 19);

    const progress = db.prepare(`SELECT * FROM case_progress WHERE user_id = 'user4'`).get();
    assert.ok(progress);
  });
});
