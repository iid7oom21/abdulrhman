#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { parseArgs, validatePublicConfig, validateOrigin, DEFAULT_ORIGIN } from './configure-cloud.mjs';

const publicFields = new Set(['rank', 'alias', 'ruleset', 'hint_count', 'wrong_count', 'elapsed_ms', 'completed_at']);
export async function checkCloud({ url, key, origin = DEFAULT_ORIGIN, allowLocal = false, requireGoogle = false, fetcher = fetch, timeoutMs = 10000 }) {
  const config = validatePublicConfig({ url, key, allowLocal });
  const allowedOrigin = validateOrigin(origin);
  const endpoint = `${config.supabaseUrl}/functions/v1/raven-api`;
  const probes = [];
  async function probe(name, method, body, sentOrigin, verify) {
    try {
      const response = await fetcher(endpoint, { method, headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', Origin: sentOrigin,
        ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'apikey,content-type' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs) });
      let data = null;
      if (method !== 'OPTIONS') data = await response.json().catch(() => null);
      const ok = verify(response, data);
      probes.push({ name, ok, status: response.status, detail: ok ? 'passed' : 'Unexpected status, CORS headers or response shape.' });
    } catch { probes.push({ name, ok: false, status: null, detail: 'Could not reach a valid response before the timeout.' }); }
  }
  await probe('anonymous-leaderboard', 'POST', { action: 'leaderboard', revision: 'case-017-expansion-v3' }, allowedOrigin, (r, data) =>
    r.status === 200 && r.headers.get('access-control-allow-origin') === allowedOrigin && data?.revision === 'case-017-expansion-v3'
    && Array.isArray(data.entries) && data.entries.length <= 50 && data.entries.every(entry => entry && typeof entry.alias === 'string' && Object.keys(entry).every(key => publicFields.has(key))));
  await probe('unauthenticated-write-rejected', 'POST', { action: 'start-run', revision: 'case-017-expansion-v3' }, allowedOrigin, r => r.status === 401);
  await probe('allowed-origin-preflight', 'OPTIONS', null, allowedOrigin, r => r.status === 204 && r.headers.get('access-control-allow-origin') === allowedOrigin && /POST/.test(r.headers.get('access-control-allow-methods') || ''));
  await probe('foreign-origin-rejected', 'POST', { action: 'leaderboard' }, 'https://raven-origin-probe.invalid', r => r.status === 403);
  const apiReady = probes.every(probe => probe.ok);
  let googleProviderEnabled = null;
  try {
    const response = await fetcher(`${config.supabaseUrl}/auth/v1/settings`, {
      method: 'GET', headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && typeof data?.external?.google === 'boolean') googleProviderEnabled = data.external.google;
    probes.push({ name: 'google-provider-enabled', required: requireGoogle === true, ok: googleProviderEnabled === true,
      status: response.status, detail: googleProviderEnabled === true ? 'Provider flag enabled; real OAuth callback remains untested.'
        : googleProviderEnabled === false ? 'Google provider is disabled.' : 'Google provider availability could not be verified.' });
  } catch {
    probes.push({ name: 'google-provider-enabled', required: requireGoogle === true, ok: false, status: null,
      detail: 'Could not verify the public Auth settings before the timeout.' });
  }
  return { ready: apiReady && (requireGoogle !== true || googleProviderEnabled === true), apiReady,
    googleProviderEnabled, googleRequired: requireGoogle === true, projectUrl: config.supabaseUrl, origin: allowedOrigin, probes,
    remaining: ['Real Google sign-in/callback', 'Two-device save conflicts', 'Authenticated full ranked run and optional publication'] };
}
export async function checkMain(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv, ['allow-local', 'require-google']);
  if (Object.keys(args).some(key => !['url', 'key-env', 'origin', 'allow-local', 'require-google'].includes(key))) throw new Error('Use --url, --key-env, --origin and optional --allow-local or --require-google.');
  return checkCloud({ url: args.url || env.RAVEN_SUPABASE_URL, key: env[args['key-env'] || 'RAVEN_SUPABASE_PUBLIC_KEY'], origin: args.origin, allowLocal: args['allow-local'], requireGoogle: args['require-google'] });
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) checkMain().then(result => { console.log(JSON.stringify(result, null, 2)); if (!result.ready) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
