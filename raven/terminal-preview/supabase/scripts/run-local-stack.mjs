#!/usr/bin/env node
// Disposable real-component integration stack. No hosted project, mocks, Google or email delivery.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const images = { postgres: 'postgres:16-alpine', auth: 'public.ecr.aws/supabase/gotrue:v2.197.0', rest: 'public.ecr.aws/supabase/postgrest:v16.4', deno: 'denoland/deno:2.5.4' };
const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = new URL('../migrations/202610230001_investigation.sql', import.meta.url);
const testFile = fileURLToPath(new URL('../tests/local-stack.test.mjs', import.meta.url));
const name = `raven-it-${randomUUID().slice(0, 8)}`;
const directory = await mkdtemp(join(tmpdir(), 'raven-real-stack-'));
const containers = [];
let networkCreated = false;
let bridgeProcess = null;
let loopbackServer = null;
let testProcess = null;
let cleanupPromise = null;
const jwtSecret = randomBytes(48).toString('hex');
const databasePassword = randomBytes(32).toString('hex');
const authenticatorPassword = randomBytes(32).toString('hex');
const jwt = role => {
  const base64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ iss: 'supabase', role, aud: 'authenticated', iat: now, exp: now + 3600 })}`;
  return `${data}.${createHmac('sha256', jwtSecret).update(data).digest('base64url')}`;
};
const anonKey = jwt('anon');
const serviceKey = jwt('service_role');
const secrets = [jwtSecret, databasePassword, authenticatorPassword, anonKey, serviceKey];
const redact = value => secrets.reduce((output, secret) => output.replaceAll(secret, '[redacted]'), String(value))
  .replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted JWT]');
const docker = (args, input) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], input, timeout: 45000 });
async function environment(label, values) {
  const path = join(directory, `${label}.env`);
  await writeFile(path, Object.entries({ HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '', NO_PROXY: 'auth,rest,db,localhost,127.0.0.1', no_proxy: 'auth,rest,db,localhost,127.0.0.1', ...values }).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
  return path;
}
function launch(label, args) {
  const id = `${name}-${label}`;
  docker(['run', '--rm', '-d', '--name', id, '--network', name, '--network-alias', label, '--label', `raven.integration=${name}`, ...args]);
  containers.push(id); return id;
}
async function waitUntil(fn, label, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    try { if (await fn()) return; } catch { /* readiness retry; never print private response */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become ready.`);
}
function diagnostics() {
  for (const container of containers) {
    try { const result = spawnSync('docker', ['logs', '--tail', '18', container], {encoding:'utf8',stdio:'pipe'}); const output = (result.stdout || '') + (result.stderr || ''); if (output.trim()) console.error(`${container}:\n${redact(output)}`); } catch { /* absent container */ }
  }
}
function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    loopbackServer?.close(); loopbackServer?.closeAllConnections();
    testProcess?.kill(); bridgeProcess?.kill();
    for (const container of [...containers].reverse()) { try { docker(['rm', '-f', container]); } catch { /* already stopped */ } }
    if (networkCreated) { try { docker(['network', 'rm', name]); } catch { /* already removed */ } }
    await rm(directory, { recursive: true, force: true });
  })();
  return cleanupPromise;
}
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => { void cleanup().finally(() => process.exit(code)); });
}

try {
  for (const image of Object.values(images)) {
    try { docker(['image', 'inspect', image, '--format', '{{.Id}}']); }
    catch { throw new Error(`Required local image is unavailable: ${image}. This runner does not pull images automatically.`); }
  }
  docker(['network', 'create', name]); networkCreated = true;
  const pg = launch('db', ['--env-file', await environment('db', { POSTGRES_PASSWORD: databasePassword }), '--tmpfs', '/var/lib/postgresql/data:rw,size=268435456', images.postgres]);
  await waitUntil(() => { docker(['exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); return true; }, 'PostgreSQL');
  const bootstrap = `
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create role service_role nologin noinherit bypassrls;
    create role authenticator login noinherit password '${authenticatorPassword}';
    grant anon,authenticated,service_role to authenticator;
    create schema auth;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `;
  docker(['exec', '-i', pg, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], bootstrap);
  launch('auth', ['--env-file', await environment('auth', {
    GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://localhost:8080/auth/v1',
    GOTRUE_SITE_URL: 'http://localhost:8080', GOTRUE_URI_ALLOW_LIST: 'http://localhost:8080', GOTRUE_DISABLE_SIGNUP: 'true',
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `postgres://postgres:${databasePassword}@db:5432/postgres?search_path=auth`,
    GOTRUE_DB_NAMESPACE: 'auth', GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_EXTERNAL_GOOGLE_ENABLED: 'false',
    GOTRUE_LOG_LEVEL: 'error',
  }), images.auth]);
  launch('rest', ['--env-file', await environment('rest', {
    PGRST_DB_URI: `postgres://authenticator:${authenticatorPassword}@db:5432/postgres`, PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: jwtSecret, PGRST_SERVER_PORT: '3000', PGRST_DB_CONFIG: 'false', PGRST_LOG_LEVEL: 'error',
  }), images.rest]);
  await writeFile(join(directory, 'router.ts'), `
    for (const key of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy']) Deno.env.delete(key);
    Deno.env.set('NO_PROXY','auth,rest,db,localhost,127.0.0.1'); Deno.env.set('no_proxy','auth,rest,db,localhost,127.0.0.1');
    Deno.serve({port:8080,hostname:'0.0.0.0'}, async request => {
      const address = new URL(request.url);
      let upstream;
      if (address.pathname.startsWith('/auth/v1/')) upstream = 'http://auth:9999' + address.pathname.slice(8) + address.search;
      else if (address.pathname.startsWith('/rest/v1/')) upstream = 'http://rest:3000' + address.pathname.slice(8) + address.search;
      else if (address.pathname === '/functions/v1/raven-api') upstream = 'http://127.0.0.1:8000/' + address.search;
      else return new Response('not found',{status:404});
      try {
        const headers = new Headers(request.headers); headers.delete('host');
        return await fetch(upstream,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'});
      } catch { return new Response('local component unavailable',{status:503}); }
    });
    await import('file:///project/raven/terminal-preview/supabase/functions/raven-api/index.ts');
  `);
  const edge = launch('edge', ['--env-file', await environment('edge', {
    SUPABASE_URL: 'http://127.0.0.1:8080', SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    RAVEN_ALLOWED_ORIGINS: 'https://iid7oom21.github.io,http://localhost:8786,http://127.0.0.1:8786',
  }), '--mount', `type=bind,source=${repository},target=/project,readonly`, '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, images.deno,
    'deno', 'run', '--allow-net', '--allow-env', '--allow-read', '/fixtures/router.ts']);
  // Docker may run outside the workspace network namespace. Bridge bytes over docker exec,
  // preserving real GoTrue/PostgREST/Edge responses rather than mocking any service.
  await writeFile(join(directory, 'bridge.ts'), `
    let buffer = '';
    const encoder = new TextEncoder();
    let writes = Promise.resolve();
    async function answer(message) {
      let result;
      try {
        const headers = new Headers(message.headers); headers.delete('host');
        const response = await fetch('http://127.0.0.1:8080' + message.path, {method:message.method,headers,
          body:['GET','HEAD'].includes(message.method)?undefined:message.body,signal:AbortSignal.timeout(20000),redirect:'manual'});
        result = {id:message.id,status:response.status,headers:[...response.headers],body:await response.text()};
      } catch { result = {id:message.id,status:503,headers:[],body:'local transport unavailable'}; }
      writes = writes.then(() => Deno.stdout.write(encoder.encode(JSON.stringify(result) + String.fromCharCode(10))));
      await writes;
    }
    for await (const chunk of Deno.stdin.readable.pipeThrough(new TextDecoderStream())) {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf(String.fromCharCode(10))) >= 0) {
        const line = buffer.slice(0,index); buffer = buffer.slice(index+1);
        if (line) void answer(JSON.parse(line));
      }
    }
  `);
  bridgeProcess = spawn('docker', ['exec','-i',edge,'deno','run','--allow-net','--allow-read','/fixtures/bridge.ts'], {stdio:['pipe','pipe','pipe']});
  bridgeProcess.stdin.on('error', () => {});
  const awaiting = new Map(); let responseBuffer = '';
  bridgeProcess.stdout.on('data', chunk => {
    responseBuffer += chunk.toString(); let index;
    while ((index = responseBuffer.indexOf('\n')) >= 0) {
      const line = responseBuffer.slice(0,index); responseBuffer = responseBuffer.slice(index+1);
      try { const result = JSON.parse(line); const resolve = awaiting.get(result.id); awaiting.delete(result.id); resolve?.(result); } catch { /* Never print private protocol contents. */ }
    }
  });
  bridgeProcess.stderr.on('data', () => {});
  loopbackServer = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const id = randomUUID();
    const result = await new Promise(resolve => {
      const timeout = setTimeout(() => { awaiting.delete(id); resolve({status:504,headers:[],body:'local transport timeout'}); }, 22000);
      awaiting.set(id, value => { clearTimeout(timeout); resolve(value); });
      bridgeProcess.stdin.write(JSON.stringify({id,path:request.url,method:request.method,headers:request.headers,body:Buffer.concat(chunks).toString()}) + '\n');
    });
    for (const [key,value] of result.headers) if (!['transfer-encoding','content-length','content-encoding'].includes(key.toLowerCase())) response.setHeader(key,value);
    response.writeHead(result.status); response.end(result.body);
  });
  await new Promise(resolve => loopbackServer.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${loopbackServer.address().port}`;
  await waitUntil(async () => (await fetch(`${base}/auth/v1/health`, { signal: AbortSignal.timeout(1000) })).ok, 'GoTrue with real Auth migrations');
  docker(['exec', '-i', pg, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], await readFile(migration, 'utf8'));
  docker(['exec', pg, 'psql', '-U', 'postgres', '-c', "NOTIFY pgrst, 'reload schema';"]);
  await waitUntil(async () => {
    const response = await fetch(`${base}/functions/v1/raven-api`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://iid7oom21.github.io' }, body: JSON.stringify({ action: 'leaderboard' }), signal: AbortSignal.timeout(2000) });
    return response.status === 200;
  }, 'PostgREST schema and actual Edge handler');
  console.log('Real local components ready: PostgreSQL16, GoTrue, PostgREST, actual Deno Edge handler. No Google flow or email delivery.');
  const exitCode = await new Promise(resolve => {
    const child = spawn(process.execPath, ['--test', testFile], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      RAVEN_LOCAL_STACK_TEST: '1', RAVEN_LOCAL_API_URL: base, RAVEN_LOCAL_ANON_KEY: anonKey, RAVEN_LOCAL_SERVICE_ROLE_KEY: serviceKey } });
    testProcess = child;
    child.stdout.on('data', bytes => process.stdout.write(redact(bytes.toString())));
    child.stderr.on('data', bytes => process.stderr.write(redact(bytes.toString())));
    child.on('error', () => resolve(1)); child.on('close', code => { testProcess = null; resolve(code); });
  });
  if (exitCode !== 0) throw new Error('Real local-stack integration assertions failed.');
  console.log('Real local integration passed; removing only this runner’s fixture infrastructure. Official Supabase CLI bundle and Google OAuth remain separate checks.');
} catch (error) {
  console.error(redact(error.message || 'Local integration failed.')); diagnostics(); process.exitCode = 1;
} finally { await cleanup(); }
