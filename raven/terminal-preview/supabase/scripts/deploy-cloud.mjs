#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, validatePublicConfig, validateOrigin, writeConfigAtomic, DEFAULT_ORIGIN, REDIRECT_PATH } from './configure-cloud.mjs';
import { checkCloud } from './check-cloud.mjs';

export const CLI_VERSION = '2.121.0';
export const WORKDIR = fileURLToPath(new URL('../../', import.meta.url));
export function deploymentPlan(options = {}, env = process.env) {
  const projectRef = options['project-ref'] || env.SUPABASE_PROJECT_REF || '';
  const origin = validateOrigin(options.origin || DEFAULT_ORIGIN);
  const blockers = [];
  if (!projectRef) blockers.push('SUPABASE_PROJECT_REF or --project-ref is required.');
  else if (!/^[a-z]{20}$/.test(projectRef)) throw new Error('Project ref must be exactly20 lowercase letters; project/branch names are not accepted.');
  const url = projectRef ? `https://${projectRef}.supabase.co` : '';
  if (env.RAVEN_SUPABASE_URL && env.RAVEN_SUPABASE_URL.replace(/\/$/, '') !== url) throw new Error('RAVEN_SUPABASE_URL does not match the explicit target project.');
  if (!env.SUPABASE_ACCESS_TOKEN) blockers.push('SUPABASE_ACCESS_TOKEN is required for non-interactive project access.');
  if (!env.SUPABASE_DB_PASSWORD) blockers.push('SUPABASE_DB_PASSWORD is required for non-interactive migrations.');
  if (!env.RAVEN_SUPABASE_PUBLIC_KEY) blockers.push('RAVEN_SUPABASE_PUBLIC_KEY is required for health checks and browser configuration.');
  let config = null;
  if (url && env.RAVEN_SUPABASE_PUBLIC_KEY) config = validatePublicConfig({ url, key: env.RAVEN_SUPABASE_PUBLIC_KEY });
  const origins = [...new Set([origin, 'http://127.0.0.1:8786', 'http://localhost:8786'])].join(',');
  const steps = projectRef ? [
    { name: 'verify-project-access', args: ['projects', 'list', '--output', 'json'] },
    { name: 'link-explicit-project', args: ['link', '--project-ref', projectRef, '--yes'] },
    { name: 'apply-database-migration', args: ['db', 'push', '--project-ref', projectRef, '--yes'] },
    { name: 'configure-browser-origins', args: ['secrets', 'set', `RAVEN_ALLOWED_ORIGINS=${origins}`, '--project-ref', projectRef] },
    { name: 'deploy-verified-api', args: ['functions', 'deploy', 'raven-api', '--project-ref', projectRef, '--no-verify-jwt', '--use-api'] },
  ] : [];
  return { projectRef, origin, url, blockers, config, steps };
}
export async function deployMain(argv = process.argv.slice(2), env = process.env, dependencies = {}) {
  const args = parseArgs(argv, ['apply', 'use-npx']);
  if (Object.keys(args).some(key => !['project-ref', 'origin', 'apply', 'use-npx', 'cli'].includes(key))) throw new Error('Use --project-ref, --origin, optional --cli or --use-npx, and --apply.');
  const plan = deploymentPlan(args, env);
  const runner = dependencies.runner || ((command, commandArgs, options) => spawnSync(command, commandArgs, options));
  const executable = args['use-npx'] ? 'npx' : args.cli || env.SUPABASE_CLI_BIN || 'supabase';
  const prefix = args['use-npx'] ? ['--yes', `supabase@${CLI_VERSION}`] : [];
  const commandOptions = { cwd: WORKDIR, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000, maxBuffer: 8 * 1024 * 1024 };
  // No remote API or mutation in default preflight mode. A CLI version check is local.
  if (!args['use-npx']) {
    const version = runner(executable, ['--version'], commandOptions);
    if (version.error || version.status !== 0) plan.blockers.push(`Supabase CLI is unavailable. Install it or pass --use-npx to use pinned CLI ${CLI_VERSION}.`);
  }
  const report = {
    mode: args.apply ? 'apply' : 'preflight', ready: plan.blockers.length === 0, deployed: false,
    projectRef: plan.projectRef || null, projectUrl: plan.url || null, origin: plan.origin, blockers: plan.blockers,
    steps: plan.steps.map(step => step.name),
    googleRedirect: plan.projectRef ? `${plan.url}/auth/v1/callback` : null,
    appRedirect: `${plan.origin}${REDIRECT_PATH}`,
    remaining: ['Owner must create the Supabase project and Google OAuth web client.', 'Enable Google provider and exact redirect URL in Supabase.', 'After deployment, verify real Google login and a complete authenticated ranked run.'],
  };
  if (!args.apply || !report.ready) return report;
  const completed = [];
  for (const step of plan.steps) {
    const result = runner(executable, [...prefix, ...step.args], commandOptions);
    if (result.error || result.status !== 0) throw new Error(`Deployment stopped at ${step.name}. Browser configuration was not enabled. Check CLI credentials/project access; subprocess output is withheld to avoid exposing secrets.`);
    if (step.name === 'verify-project-access') {
      let projects;
      try { projects = JSON.parse(result.stdout); } catch { throw new Error('Could not verify the accessible project list; no deployment performed.'); }
      if (!Array.isArray(projects) || !projects.some(project => project.id === plan.projectRef || project.ref === plan.projectRef)) throw new Error('The requested project is not accessible to this CLI account; no deployment performed.');
    }
    completed.push(step.name);
  }
  const health = await checkCloud({ url: plan.url, key: plan.config.publishableKey, origin: plan.origin, requireGoogle: true, fetcher: dependencies.fetcher || fetch });
  if (!health.ready) return { ...report, ready: false, deployed: true, configured: false, completed, health,
    blockers: ['Backend commands completed, but API or Google-provider readiness checks failed; runtime-config.js remains unchanged.'] };
  await (dependencies.writeConfig || writeConfigAtomic)(plan.config);
  return { ...report, ready: true, deployed: true, configured: true, completed, health,
    next: 'Publish the updated static runtime-config.js. Complete the real Google and authenticated-run acceptance checks.' };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) deployMain().then(report => {
  console.log(JSON.stringify(report, null, 2)); if (!report.ready) process.exitCode = 1;
}).catch(error => { console.error(error.message); process.exitCode = 1; });
