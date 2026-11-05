import express from 'express';
import {createHash} from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb, migrate, seedPackages } from './db.js';
import { createPaymentIntent, verifyWebhookSignature, simulatePaidWebhook } from './services/paymentSimulator.js';
import { generateDialogueReply, estimateCost } from './services/aiSimulator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.env.CONFIG || path.join(__dirname, '../config.example.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (config.simulation !== true || config.payment?.provider !== 'simulation' || config.ai?.provider !== 'simulation') {
  throw new Error('live_payments_not_implemented');
}
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:40000}));
app.use((req,res,next)=>{
  if(req.path === '/health')return next();
  if(process.env.RAVEN_ENABLE_CREDIT_SIMULATION !== '1')return res.status(503).json({error:'credit_simulation_disabled',livePayments:false});
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return res.status(403).json({error:'local_simulation_only'});
  if(req.headers['sec-fetch-site'] === 'cross-site' || req.headers.origin)return res.status(403).json({error:'cross_site'});
  next();
});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);

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

app.get('/health', (req, res) => res.json({ ok: true, simulation: true, livePayments:false, enabled:process.env.RAVEN_ENABLE_CREDIT_SIMULATION === '1', authenticatedUsers:false }));

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
  if (!validId(userId) || !validId(packageId) || !validId(idempotencyKey)) return res.status(400).json({ error: 'missing fields' });

  const existing = db.prepare(`SELECT * FROM payments WHERE idempotency_key = ?`).get(idempotencyKey);
  if (existing) {
    if(existing.user_id!==userId || existing.package_id!==packageId)return res.status(409).json({error:'idempotency_conflict'});
    return res.json({existing:true,payment:existing,simulation:true});
  }

  const pkg = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(packageId);
  if (!pkg || pkg.active !== 1) return res.status(404).json({ error: 'package not found' });

  getOrCreateUser(userId);
  const intent = createPaymentIntent({
    userId,
    packageId,
    amount: pkg.price_sar,
    currency: 'SAR',
    idempotencyKey
  });

  db.transaction(()=>{
  db.prepare(`
    INSERT INTO payments (id, user_id, package_id, amount, currency, status, idempotency_key)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(intent.id, userId, packageId, pkg.price_sar, 'SAR', idempotencyKey);

    db.prepare('INSERT INTO simulation_quotes (payment_id,messages) VALUES (?,?)').run(intent.id,pkg.messages);
  })();

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
  if (payment.amount !== amount || payment.currency !== currency) {
    return res.status(400).json({ error: 'amount/currency mismatch' });
  }

  if (payment.status === 'paid')return res.json({ok:true,alreadyProcessed:true});
  const quote = db.prepare('SELECT messages FROM simulation_quotes WHERE payment_id = ?').get(paymentId);
  if(!quote)return res.status(409).json({error:'quote_not_available'});
  const tx = db.transaction(() => {
    db.prepare(`UPDATE payments SET status = 'paid', signature_verified = 1, processed_at = datetime('now') WHERE id = ?`).run(paymentId);
    addCredit(payment.user_id, quote.messages, 'purchase', paymentId);
  });
  tx();

  res.json({ ok: true, credited: quote.messages });
});

app.post('/dialogue', (req,res)=>{
  const {requestId,userId,caseId,message,preferAi=false}=req.body;
  if(!validId(requestId)||!validId(userId)||!validId(caseId)||typeof message!=='string'||!message.trim()||message.length>8000||typeof preferAi!=='boolean')return res.status(400).json({error:'invalid_request'});
  const fingerprint=createHash('sha256').update(JSON.stringify({userId,caseId,message,preferAi,version:'credit-simulation-v1'})).digest('hex');
  const existing=db.prepare('SELECT * FROM simulation_requests WHERE id = ?').get(requestId);
  if(existing){
    if(existing.user_id!==userId||existing.fingerprint!==fingerprint)return res.status(409).json({error:'request_id_conflict'});
    return res.json({...JSON.parse(existing.response_json),replayed:true});
  }
  // This is a synchronous local fixture ONLY. Real provider work needs reservation/settlement,
  // authenticated identity and a durable financial ledger; it cannot use this transaction.
  const result=db.transaction(()=>{
    const credit=getOrCreateUser(userId);
    let mode='written',reply;
    if(preferAi&&credit.balance_messages>0){
      reply=generateDialogueReply({caseId,userMessage:message,mode:'ai'});
      consumeCredit(userId,1);mode='ai';
    }else reply={text:'حوار مكتوب تجريبي (مجاني). هذه ليست قضية كاملة.',mode:'written'};
    db.prepare(`INSERT INTO case_progress (user_id,case_id,stage,updated_at) VALUES (?,?,'dialogue',datetime('now'))
      ON CONFLICT(user_id,case_id) DO UPDATE SET updated_at=datetime('now')`).run(userId,caseId);
    const response={mode,reply,remaining:db.prepare('SELECT balance_messages FROM user_credits WHERE user_id = ?').get(userId).balance_messages,simulation:true};
    db.prepare('INSERT INTO simulation_requests (id,user_id,fingerprint,response_json) VALUES (?,?,?,?)').run(requestId,userId,fingerprint,JSON.stringify(response));
    return response;
  })();
  res.json({...result,replayed:false});
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

app.use((error,req,res,next)=>res.status(error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:503).json({error:'simulation_operation_failed'}));

const port = config.port || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '127.0.0.1', () => {
    console.log(`RAVEN credit server (simulation) on :${port}`);
  });
}

export { app, db };
