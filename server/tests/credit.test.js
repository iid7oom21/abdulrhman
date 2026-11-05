import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {migrate} from '../src/db.js';
import {createHmac} from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app;
let db;
let testDir;

before(async () => {
  testDir=fs.mkdtempSync(path.join(os.tmpdir(),'raven-credit-tests-'));
  const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../config.example.json'),'utf8'));
  cfg.dbPath=path.join(testDir,'test.sqlite');
  process.env.CONFIG=path.join(testDir,'config.json');fs.writeFileSync(process.env.CONFIG,JSON.stringify(cfg));
  process.env.NODE_ENV='test';process.env.RAVEN_ENABLE_CREDIT_SIMULATION='1';
  const mod = await import('../src/index.js');
  app = mod.app;
  db = mod.db;
});

after(() => {
  try { db.close(); } catch {}
  fs.rmSync(testDir,{recursive:true});
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
      requestId:'written-one', userId: 'user3',
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
      requestId:'consume-one', userId: 'user4',
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


describe('Simulator safety gates and failure accounting',()=>{
  async function funded(user){
    const order=await request(app).post('/payments/create').send({userId:user,packageId:'pack_small',idempotencyKey:'order-'+user});
    assert.equal(order.status,200);
    const sim=await request(app).post('/simulation/pay').send({paymentId:order.body.payment.id});
    return {order:order.body.payment,notify:()=>request(app).post('/webhooks/payment').set('x-sim-signature',sim.body.signature).send(sim.body.payload),payload:sim.body.payload,signature:sim.body.signature};
  }
  it('is disabled by default and cannot be configured as a live gateway',async()=>{
    delete process.env.RAVEN_ENABLE_CREDIT_SIMULATION;
    assert.equal((await request(app).post('/payments/create').send({})).status,503);
    assert.equal((await request(app).get('/health')).body.livePayments,false);
    process.env.RAVEN_ENABLE_CREDIT_SIMULATION='1';
    const cfg=JSON.parse(fs.readFileSync(process.env.CONFIG,'utf8'));cfg.simulation=false;
    const target=path.join(testDir,'live-config.json');fs.writeFileSync(target,JSON.stringify(cfg));
    const child=spawnSync(process.execPath,['src/index.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,CONFIG:target},encoding:'utf8'});
    assert.notEqual(child.status,0);assert.match(child.stderr,/live_payments_not_implemented/);
    assert.equal((await request(app).post('/payments/create').set('Sec-Fetch-Site','cross-site').send({})).status,403);
  });
  it('rejects the historical signature-prefix bypass and tampered payloads',async()=>{
    const f=await funded('signature');
    assert.equal((await request(app).post('/webhooks/payment').set('x-sim-signature','sim_valid_forged').send(f.payload)).status,401);
    assert.equal((await request(app).post('/webhooks/payment').set('x-sim-signature',f.signature).send({...f.payload,amount:1})).status,401);
    const secret=JSON.parse(fs.readFileSync(process.env.CONFIG,'utf8')).webhookSecret;
    for(const altered of [{...f.payload,amount:1},{...f.payload,currency:'USD'}]){
      const signature=createHmac('sha256',secret).update(JSON.stringify(altered)).digest('hex');
      assert.equal((await request(app).post('/webhooks/payment').set('x-sim-signature',signature).send(altered)).status,400);
    }
    assert.equal((await request(app).get('/credits/signature')).body.balance_messages,0);
  });
  it('purchase idempotency conflicts on another owner/package and snapshots the entitlement',async()=>{
    const f=await funded('quote');
    for(const body of [{userId:'someoneelse',packageId:'pack_small'},{userId:'quote',packageId:'pack_large'}]){
      const result=await request(app).post('/payments/create').send({...body,idempotencyKey:'order-quote'});assert.equal(result.status,409);assert.equal(result.body.payment,undefined);
    }
    db.prepare("UPDATE packages SET messages=999 WHERE id='pack_small'").run();
    try{assert.equal((await f.notify()).body.credited,20);}finally{db.prepare("UPDATE packages SET messages=20 WHERE id='pack_small'").run();}
    assert.equal((await f.notify()).body.alreadyProcessed,true);
    assert.equal((await request(app).get('/credits/quote')).body.balance_messages,20);
  });
  it('replaying a dialogue operation neither generates nor debits again; changed payload conflicts',async()=>{
    const f=await funded('replay');await f.notify();
    const body={requestId:'request-replay',userId:'replay',caseId:'on-the-other-side',message:'question',preferAi:true};
    const first=await request(app).post('/dialogue').send(body),second=await request(app).post('/dialogue').send(body);
    assert.equal(first.body.remaining,19);assert.equal(second.body.replayed,true);assert.deepEqual(second.body.reply,first.body.reply);
    assert.equal((await request(app).post('/dialogue').send({...body,message:'changed'})).status,409);
    assert.equal(db.prepare("SELECT count(*) AS n FROM credit_ledger WHERE user_id='replay' AND reason='consume'").get().n,1);
  });
  it('two requests on the final simulated entitlement cannot overdraw it',async()=>{
    const f=await funded('last');await f.notify();db.prepare("UPDATE user_credits SET balance_messages=1 WHERE user_id='last'").run();
    const body={userId:'last',caseId:'on-the-other-side',message:'question',preferAi:true};
    const results=await Promise.all(['one','two'].map(id=>request(app).post('/dialogue').send({...body,requestId:'last-'+id})));
    assert.deepEqual(results.map(r=>r.body.mode).sort(),['ai','written']);
    assert.equal((await request(app).get('/credits/last')).body.balance_messages,0);
  });
  it('schema migration is repeatable and preserves existing orders and balances',()=>{
    const orders=db.prepare('SELECT * FROM payments ORDER BY id').all(),balances=db.prepare('SELECT * FROM user_credits ORDER BY user_id').all();
    const command=spawnSync(process.execPath,['src/migrate.js'],{cwd:path.join(__dirname,'..'),env:process.env,encoding:'utf8'});assert.equal(command.status,0,command.stderr);
    migrate(db);assert.deepEqual(db.prepare('SELECT * FROM payments ORDER BY id').all(),orders);assert.deepEqual(db.prepare('SELECT * FROM user_credits ORDER BY user_id').all(),balances);
  });
  it('failed response persistence rolls back the local debit and progress',async()=>{
    const f=await funded('rollback');await f.notify();
    db.exec("CREATE TRIGGER fail_test_response BEFORE INSERT ON simulation_requests WHEN NEW.id='rollback-one' BEGIN SELECT RAISE(ABORT,'test_failure'); END;");
    try{
      const r=await request(app).post('/dialogue').send({requestId:'rollback-one',userId:'rollback',caseId:'on-the-other-side',message:'question',preferAi:true});
      assert.equal(r.status,503);assert.equal((await request(app).get('/credits/rollback')).body.balance_messages,20);
      assert.equal(db.prepare("SELECT count(*) AS n FROM credit_ledger WHERE user_id='rollback' AND reason='consume'").get().n,0);
      assert.equal(db.prepare("SELECT count(*) AS n FROM case_progress WHERE user_id='rollback'").get().n,0);
    }finally{db.exec('DROP TRIGGER fail_test_response');}
  });
});
