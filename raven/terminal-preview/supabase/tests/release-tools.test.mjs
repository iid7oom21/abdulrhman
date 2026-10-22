import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePublicConfig, validateOrigin, writeConfigAtomic } from '../scripts/configure-cloud.mjs';
import { checkCloud } from '../scripts/check-cloud.mjs';
import { deploymentPlan, deployMain, CLI_VERSION } from '../scripts/deploy-cloud.mjs';

const projectRef = 'abcdefghijklmnopqrst';
const url = `https://${projectRef}.supabase.co`;
const key = 'sb_publishable_RAVEN_TEST_PLACEHOLDER';
const env = { SUPABASE_PROJECT_REF: projectRef, RAVEN_SUPABASE_PUBLIC_KEY: key, SUPABASE_ACCESS_TOKEN: 'private-access-placeholder', SUPABASE_DB_PASSWORD: 'private-password-placeholder' };
const jwt = claims => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.c2lnbmF0dXJl`;
const validProbe = async (_url, options) => {
  if (new URL(_url).pathname === '/auth/v1/settings') return new Response(JSON.stringify({ external: { google: true } }), { status: 200 });
  const origin = options.headers.Origin;
  if (origin === 'https://raven-origin-probe.invalid') return new Response('{}', { status: 403 });
  if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (JSON.parse(options.body).action === 'start-run') return new Response('{}', { status: 401 });
  return new Response(JSON.stringify({ revision: 'case-017-expansion-v3', entries: [] }), { status: 200, headers: { 'Access-Control-Allow-Origin': origin } });
};

test('public config rejects secret-role keys, expired JWTs and unsafe project URLs', () => {
  assert.equal(validatePublicConfig({ url, key }).keyType, 'publishable');
  assert.equal(validatePublicConfig({ url, key: jwt({ role: 'anon', exp: 4102444800 }) }).keyType, 'anon-jwt');
  for (const invalid of ['sb_secret_PRIVATE_PLACEHOLDER', jwt({ role: 'service_role' }), jwt({ role: 'anon', exp: 1 }), 'arbitrary-secret']) {
    assert.throws(() => validatePublicConfig({ url, key: invalid }), /public|role|expired|secret/i);
  }
  for (const invalid of ['http://database.invalid', `${url}/rest/v1`, `${url}?key=hidden`, 'https://user:pass@database.invalid']) assert.throws(() => validatePublicConfig({ url: invalid, key }));
  assert.throws(() => validatePublicConfig({ url: 'http://localhost:54321', key }));
  assert.equal(validatePublicConfig({ url: 'http://localhost:54321', key, allowLocal: true }).supabaseUrl, 'http://localhost:54321');
});

test('origin is exact and does not silently discard paths or credentials', () => {
  assert.equal(validateOrigin('https://iid7oom21.github.io'), 'https://iid7oom21.github.io');
  assert.throws(() => validateOrigin('https://iid7oom21.github.io/abdulrhman'));
  assert.throws(() => validateOrigin('https://user:pass@example.invalid'));
});

test('atomic configuration replaces the existing file and leaves no temporary fragments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'raven-config-test-'));
  try {
    const target = join(directory, 'runtime-config.js'); await writeFile(target, 'old');
    await writeConfigAtomic(validatePublicConfig({ url, key }), target);
    const content = await readFile(target, 'utf8');
    assert.match(content, /Object.freeze/); assert.ok(content.includes(url)); assert.ok(content.includes(key));
    assert.deepEqual(await readdir(directory), ['runtime-config.js']);
    await assert.rejects(writeConfigAtomic(validatePublicConfig({ url, key }), join(directory, 'missing.js')), /ENOENT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('health checks use only the public key and distinguish API and Google-provider readiness', async () => {
  const calls = [];
  const health = await checkCloud({ url, key, requireGoogle: true, fetcher: async (address, options) => { calls.push(options); return validProbe(address, options); } });
  assert.equal(health.ready, true); assert.equal(health.apiReady, true); assert.equal(health.probes.length, 5);
  assert.equal(health.googleProviderEnabled, true); assert.equal(health.googleRequired, true);
  assert.equal(calls.at(-1).method, 'GET'); assert.equal(calls.at(-1).headers.apikey, key);
  assert.equal(calls.some(options => 'Authorization' in options.headers), false);
  assert.equal(JSON.stringify(health).includes(key), false);
  assert.ok(health.remaining.includes('Real Google sign-in/callback'));
});

test('Google-disabled local API readiness is explicit and cannot pass Google-required checks', async () => {
  const fetcher = (address, options) => new URL(address).pathname === '/auth/v1/settings'
    ? new Response(JSON.stringify({ external: { google: false } }), { status: 200 }) : validProbe(address, options);
  const local = await checkCloud({ url: 'http://localhost:54321', key, allowLocal: true, fetcher });
  assert.equal(local.ready, true); assert.equal(local.apiReady, true);
  assert.equal(local.googleProviderEnabled, false); assert.equal(local.googleRequired, false);
  assert.equal(local.probes.at(-1).ok, false); assert.equal(local.probes.at(-1).required, false);
  const production = await checkCloud({ url, key, requireGoogle: true, fetcher });
  assert.equal(production.ready, false); assert.equal(production.apiReady, true);
});

test('missing, malformed, unauthorized or unreachable Auth settings never verify Google readiness', async () => {
  const variants = [
    () => new Response('{}', { status: 200 }),
    () => new Response(JSON.stringify({ external: { google: 'true' } }), { status: 200 }),
    () => new Response(JSON.stringify({ external: { google: true } }), { status: 401 }),
    () => { throw new Error(`private diagnostic ${env.SUPABASE_ACCESS_TOKEN}`); },
  ];
  for (const settings of variants) {
    const health = await checkCloud({ url, key, requireGoogle: true, fetcher: (address, options) =>
      new URL(address).pathname === '/auth/v1/settings' ? settings() : validProbe(address, options) });
    assert.equal(health.ready, false); assert.equal(health.apiReady, true); assert.equal(health.googleProviderEnabled, null);
    assert.equal(health.probes.at(-1).ok, false);
    assert.equal(JSON.stringify(health).includes(env.SUPABASE_ACCESS_TOKEN), false);
    assert.equal(JSON.stringify(health).includes(key), false);
  }
});

test('health check rejects public private-field leaks and does not claim failed network is ready', async () => {
  const leaking = await checkCloud({ url, key, fetcher: async (address, options) => {
    if (options.body && JSON.parse(options.body).action === 'leaderboard' && options.headers.Origin !== 'https://raven-origin-probe.invalid') return new Response(JSON.stringify({ revision: 'case-017-expansion-v3', entries: [{ alias: 'name', user_id: 'private' }] }), { status: 200, headers: { 'Access-Control-Allow-Origin': options.headers.Origin } });
    return validProbe(address, options);
  } });
  assert.equal(leaking.ready, false); assert.equal(leaking.probes[0].ok, false);
  const offline = await checkCloud({ url, key, fetcher: async () => { throw new Error('secret diagnostic'); } });
  assert.equal(offline.ready, false); assert.equal(JSON.stringify(offline).includes('secret diagnostic'), false);
});

test('deployment preflight lists missing names only and never invokes remote commands or writer', async () => {
  let invoked = 0; let writes = 0;
  const report = await deployMain([], {}, { runner: (_bin, args) => { invoked++; assert.deepEqual(args, ['--version']); return { status: 1 }; }, writeConfig: () => { writes++; } });
  assert.equal(report.ready, false); assert.equal(report.deployed, false); assert.equal(invoked, 1); assert.equal(writes, 0);
  assert.ok(report.blockers.some(text => text.includes('SUPABASE_PROJECT_REF')));
});

test('explicit project must match canonical URL and secrets never enter CLI arguments or reports', async () => {
  assert.throws(() => deploymentPlan({ 'project-ref': '--wrong' }, env), /Project ref/);
  assert.throws(() => deploymentPlan({}, { ...env, RAVEN_SUPABASE_URL: 'https://other-project.supabase.co' }), /does not match/);
  const report = await deployMain(['--use-npx'], env, { runner: () => { throw new Error('No command expected in preflight'); } });
  assert.equal(report.ready, true); assert.equal(report.deployed, false);
  const plan = deploymentPlan({}, env);
  for (const secret of [key, env.SUPABASE_ACCESS_TOKEN, env.SUPABASE_DB_PASSWORD]) {
    assert.equal(JSON.stringify(report).includes(secret), false);
    assert.equal(JSON.stringify(plan.steps).includes(secret), false);
  }
});

test('apply verifies account access before remote mutations and refuses unknown target', async () => {
  const calls = [];
  await assert.rejects(deployMain(['--use-npx', '--apply'], env, { runner: (_bin, args) => { calls.push(args); return { status: 0, stdout: '[]' }; } }), /not accessible/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 2), ['--yes', `supabase@${CLI_VERSION}`]);
  assert.ok(calls[0].includes('projects'));
});

test('successful apply enables browser config only after deployment and healthy anonymous probes', async () => {
  const calls = []; let written = null;
  const report = await deployMain(['--use-npx', '--apply'], env, { runner: (_bin, args) => {
    calls.push(args); return { status: 0, stdout: args.includes('projects') ? JSON.stringify([{ id: projectRef }]) : '' };
  }, fetcher: validProbe, writeConfig: async config => { written = config; } });
  assert.equal(calls.length, 5); assert.equal(report.deployed, true); assert.equal(report.configured, true); assert.equal(written.supabaseUrl, url);
  assert.equal(report.health.googleRequired, true); assert.equal(report.health.googleProviderEnabled, true);
  assert.equal(JSON.stringify(report).includes(key), false);
});

test('deployment leaves browser configuration untouched when Google is disabled or unverifiable', async () => {
  for (const settings of [
    () => new Response(JSON.stringify({ external: { google: false } }), { status: 200 }),
    () => new Response('{}', { status: 200 }),
    () => new Response('{}', { status: 401 }),
    () => { throw new Error('private diagnostic'); },
  ]) {
    let writes = 0;
    const report = await deployMain(['--use-npx', '--apply'], env, {
      runner: (_bin, args) => ({ status: 0, stdout: args.includes('projects') ? JSON.stringify([{ id: projectRef }]) : '' }),
      fetcher: (address, options) => new URL(address).pathname === '/auth/v1/settings' ? settings() : validProbe(address, options),
      writeConfig: () => { writes++; },
    });
    assert.equal(report.deployed, true); assert.equal(report.configured, false); assert.equal(report.ready, false);
    assert.equal(report.health.apiReady, true); assert.equal(writes, 0);
    assert.equal(JSON.stringify(report).includes('private diagnostic'), false);
  }
});

test('unhealthy deployment leaves runtime config untouched; command failure withholds diagnostic secrets', async () => {
  let writes = 0;
  const report = await deployMain(['--use-npx', '--apply'], env, { runner: (_bin, args) => ({ status: 0, stdout: args.includes('projects') ? JSON.stringify([{ id: projectRef }]) : '' }),
    fetcher: async () => new Response('{}', { status: 503 }), writeConfig: () => { writes++; } });
  assert.equal(report.deployed, true); assert.equal(report.ready, false); assert.equal(report.configured, false); assert.equal(writes, 0);
  await assert.rejects(deployMain(['--use-npx', '--apply'], env, { runner: () => ({ status: 1, stderr: env.SUPABASE_ACCESS_TOKEN }) }), error => !error.message.includes(env.SUPABASE_ACCESS_TOKEN));
});
