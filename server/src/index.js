import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb, migrate, seedPackages } from './db.js';
import { createPaymentIntent, verifyWebhookSignature, simulatePaidWebhook } from './services/paymentSimulator.js';
import { generateDialogueReply, estimateCost } from './services/aiSimulator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.env.CONFIG || path.join(__dirname, '../config.example.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = express();
app.use(cors());
app.use(express.json());

const db = openDb(config.dbPath);
migrate(db);
seedPackages(db, config.packages);

function getOrCreateUser(userId, displayName) {
  db.prepare(`INSERT OR IGNORE INTO users (id, display_name) VALUES (?, ?)`).run(userId, displayName || null);
  db.prepare(`INSERT OR IGNORE INTO user_credits (user_id, balance_messages) VALUES (?, 0)`).run(userId);
  return db.prepare(`SELECT * FROM user_credits WHERE user_id = ?`).get(userId);
}

function addCredit(userId, messages, reason, relatedPaymentId) {
  const tx = db.transaction(() => {
    db.prepare(`UPDATE user_credits SET balance_messages = balance_messages + ?, updated_at = datetime('now') WHERE user_id = ?`).run(messages, userId);
    db.prepare(`INSERT INTO credit_ledger (user_id, delta_messages, reason, related_payment_id) VALUES (?, ?, ?, ?)`).run(userId, messages, reason, relatedPaymentId || null);
  });
  tx();
}

function consumeCredit(userId, messages = 1) {
  const tx = db.transaction(() => {
    const row = db.prepare(`SELECT balance_messages FROM user_credits WHERE user_id = ?`).get(userId);
    if (!row || row.balance_messages < messages) {
      throw new Error('INSUFFICIENT_CREDIT');
    }
    db.prepare(`UPDATE user_credits SET balance_messages = balance_messages - ?, updated_at = datetime('now') WHERE user_id = ?`).run(messages, userId);
    db.prepare(`INSERT INTO credit_ledger (user_id, delta_messages, reason) VALUES (?, ?, 'consume')`).run(userId, -messages);
    return row.balance_messages - messages;
  });
  return tx();
}

app.get('/health', (req, res) => res.json({ ok: true, simulation: config.simulation }));

app.get('/packages', (req, res) => {
  const rows = db.prepare(`SELECT * FROM packages WHERE active = 1`).all();
  const withEstimate = rows.map(p => ({
    ...p,
    estimatedCost: estimateCost({ messages: p.messages }),
    collectionFeeNote: `رسوم تحصيل تقديرية ${config.payment.collectionFeePercent}% + ${config.payment.fixedFeeHalalas} هللة`
  }));
  res.json(withEstimate);
});

app.get('/credits/:userId', (req, res) => {
  const credit = getOrCreateUser(req.params.userId);
  res.json(credit);
});

app.post('/payments/create', (req, res) => {
  const { userId, packageId, idempotencyKey } = req.body;
  if (!userId || !packageId || !idempotencyKey) return res.status(400).json({ error: 'missing fields' });

  const existing = db.prepare(`SELECT * FROM payments WHERE idempotency_key = ?`).get(idempotencyKey);
  if (existing) return res.json({ existing: true, payment: existing });

  const pkg = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(packageId);
  if (!pkg) return res.status(404).json({ error: 'package not found' });

  getOrCreateUser(userId);
  const intent = createPaymentIntent({
    userId,
    packageId,
    amount: pkg.price_sar,
    currency: 'SAR',
    idempotencyKey
  });

  db.prepare(`
    INSERT INTO payments (id, user_id, package_id, amount, currency, status, idempotency_key)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(intent.id, userId, packageId, pkg.price_sar, 'SAR', idempotencyKey);

  res.json({ payment: intent, note: 'محاكاة فقط. لا يتم خصم أموال حقيقية.' });
});

app.post('/webhooks/payment', (req, res) => {
  const signature = req.headers['x-signature'] || req.headers['x-sim-signature'];
  const payload = req.body;

  if (!verifyWebhookSignature(payload, signature, config.webhookSecret)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  const { paymentId, amount, currency, status } = payload;
  if (status !== 'paid') return res.status(400).json({ error: 'not paid' });

  const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (!payment) return res.status(404).json({ error: 'payment not found' });
  if (payment.status === 'paid') {
    return res.json({ ok: true, alreadyProcessed: true });
  }
  if (payment.amount !== amount || payment.currency !== currency) {
    return res.status(400).json({ error: 'amount/currency mismatch' });
  }

  const pkg = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(payment.package_id);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE payments SET status = 'paid', signature_verified = 1, processed_at = datetime('now') WHERE id = ?`).run(paymentId);
    addCredit(payment.user_id, pkg.messages, 'purchase', paymentId);
  });
  tx();

  res.json({ ok: true, credited: pkg.messages });
});

app.post('/dialogue', (req, res) => {
  const { userId, caseId, message, preferAi } = req.body;
  if (!userId || !caseId || !message) return res.status(400).json({ error: 'missing fields' });

  const credit = getOrCreateUser(userId);
  let mode = 'written';
  let reply;

  if (preferAi && credit.balance_messages > 0) {
    try {
      consumeCredit(userId, 1);
      mode = 'ai';
      reply = generateDialogueReply({ caseId, userMessage: message, mode: 'ai' });
    } catch (e) {
      if (e.message === 'INSUFFICIENT_CREDIT') {
        mode = 'written';
        reply = { text: 'رصيد الحوار بالذكاء الاصطناعي نفد. يتم الرجوع للحوار المكتوب.', mode: 'written' };
      } else throw e;
    }
  } else {
    reply = { text: 'حوار مكتوب (مجاني). استخدم الأدلة الموجودة فقط.', mode: 'written' };
  }

  db.prepare(`
    INSERT INTO case_progress (user_id, case_id, stage, updated_at)
    VALUES (?, ?, 'dialogue', datetime('now'))
    ON CONFLICT(user_id, case_id) DO UPDATE SET updated_at = datetime('now')
  `).run(userId, caseId);

  res.json({ mode, reply, remaining: db.prepare(`SELECT balance_messages FROM user_credits WHERE user_id = ?`).get(userId).balance_messages });
});

app.post('/simulation/pay', (req, res) => {
  if (!config.simulation) return res.status(403).json({ error: 'not simulation' });
  const { paymentId } = req.body;
  const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (!payment) return res.status(404).json({ error: 'not found' });
  const { payload, signature } = simulatePaidWebhook({
    paymentId,
    amount: payment.amount,
    currency: payment.currency,
    secret: config.webhookSecret
  });
  res.json({ payload, signature, instruction: 'أرسل هذا إلى /webhooks/payment مع الهيدر x-sim-signature' });
});

const port = config.port || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`RAVEN credit server (simulation) on :${port}`);
  });
}

export { app, db };
