#!/usr/bin/env node
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CONFIG_PATH = fileURLToPath(new URL('../../modules/runtime-config.js', import.meta.url));
export const DEFAULT_ORIGIN = 'https://iid7oom21.github.io';
export const REDIRECT_PATH = '/abdulrhman/raven/terminal-preview/case-017/';
export function parseArgs(argv, switches = ['write', 'disable', 'allow-local']) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error('Arguments must use named --options.');
    const name = key.slice(2);
    if (switches.includes(name)) options[name] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for --${name}.`);
      options[name] = argv[++i];
    }
  }
  return options;
}
export function validateOrigin(value = DEFAULT_ORIGIN) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Origin must be an exact http(s) origin without path or credentials.');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Non-local origins must use HTTPS.');
  return url.origin;
}
export function validatePublicConfig({ url, key, allowLocal = false }) {
  if (typeof url !== 'string' || typeof key !== 'string' || !key.trim()) throw new Error('Provide the project URL and a public publishable/anon key.');
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Project URL must be a bare origin without credentials, path, query or fragment.');
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(allowLocal && local && parsed.protocol === 'http:')) throw new Error('Use HTTPS; local HTTP requires --allow-local.');
  const publicKey = key.trim();
  let keyType;
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(publicKey)) keyType = 'publishable';
  else if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publicKey)) {
    let claim;
    try { claim = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString('utf8')); } catch { throw new Error('The legacy public key is not a valid JWT payload.'); }
    if (claim?.role !== 'anon') throw new Error('Only the public anon role is accepted; service-role and secret keys must never enter browser config.');
    if (Number.isFinite(claim.exp) && claim.exp * 1000 <= Date.now()) throw new Error('The public anon key has expired.');
    keyType = 'anon-jwt';
  } else throw new Error('Use a public sb_publishable_ key or legacy anon JWT; secret keys are rejected.');
  return { supabaseUrl: parsed.origin, publishableKey: publicKey, functionName: 'raven-api', redirectPath: 'case-017/', keyType };
}
export function renderConfig(config) {
  const { supabaseUrl, publishableKey, functionName, redirectPath } = config;
  return `// Public configuration only. Never add a service-role key or Google client secret.\nexport const CLOUD_CONFIG = Object.freeze(${JSON.stringify({ supabaseUrl, publishableKey, functionName, redirectPath }, null, 2)});\n`;
}
export async function writeConfigAtomic(config, target = CONFIG_PATH) {
  // Read first so a missing/wrong checkout fails instead of creating a stray file.
  await readFile(target, 'utf8');
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, renderConfig(config), { mode: 0o644, flag: 'wx' }); await rename(temporary, target); }
  finally { await unlink(temporary).catch(() => {}); }
}
export async function configureMain(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const allowed = ['url', 'key-env', 'write', 'disable', 'allow-local'];
  if (Object.keys(args).some(key => !allowed.includes(key))) throw new Error('Unknown option. Use --url, --key-env, --write, --disable or --allow-local.');
  const config = args.disable ? { supabaseUrl: '', publishableKey: '', functionName: 'raven-api', redirectPath: 'case-017/', keyType: 'disabled' }
    : validatePublicConfig({ url: args.url || env.RAVEN_SUPABASE_URL, key: env[args['key-env'] || 'RAVEN_SUPABASE_PUBLIC_KEY'], allowLocal: args['allow-local'] });
  if (args.write) await writeConfigAtomic(config);
  return { written: Boolean(args.write), enabled: !args.disable, projectUrl: config.supabaseUrl || null, keyType: config.keyType, target: CONFIG_PATH,
    next: args.write ? 'Publish the static-site change after hosted checks pass.' : 'Validated only. Add --write to replace runtime-config.js atomically.' };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) configureMain().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
