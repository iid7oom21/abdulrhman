# RAVEN cloud saves and verified competitive runs

Status: implemented and locally tested; **not deployed or connected to a Supabase project**. Local practice remains fully available. `modules/runtime-config.js` intentionally has empty service values, and the UI says that Google, cloud saves and leaderboard await configuration. No fake Google session or fabricated leaderboard is provided.

## What is implemented

- Optional Google sign-in via Supabase Auth PKCE, with verifier lifetime, matching callback path, refresh-token handling and logout/account-change guards. Tokens stay in this origin's local store and are never rendered publicly. Stale refresh/API responses cannot restore a logged-out account.
- Practice saves use a per-account revision and compare-and-swap. Two devices cannot silently overwrite one another. Conflicts retain local and remote copies and require a choice. Once enabled, changes sync after a short debounce; offline state stays local.
- Ranked runs start fresh on the server and cannot import a practice save. A start request resumes an existing active run for the same account/revision. The clock starts on the server and continues through navigation, logout and network loss. Only the accepted A32 action stops it.
- Every ranked view, answer, hint and abandon action is authenticated and committed atomically. Answers are checked with the same pure evaluator as practice, including the accepted contiguous prefix, available/opened evidence and actual file-manifest hashes. Malformed/incomplete submissions do not count as wrong answers. New hint levels and valid wrong answers are counted once.
- Request UUIDs are idempotent before stale-sequence and completed-run checks, including the duplicate-request race between initial cache lookup and current-state read. The immutable original response is returned on retry. Frontend snapshot cache never regresses its sequence. A bounded account-specific pending-event registry preserves the original UUID and sequence across lost responses and reloads, even if a retrying button supplies a new UUID; definite responses clear the pending entry.
- Publication is opt-in with a chosen alias of 3–24 characters. The best result per account and ruleset is ordered by fewer hints, fewer mistakes, less elapsed time, then earlier completion. Public responses expose only rank, alias, ruleset and score/time fields, never email, Google name, user UUID or run UUID. The API returns at most 50 entries. Hiding/re-publishing changes visibility without replacing a better score with a worse one.

This verifies accepted actions and score ownership on the server. As with any open-source puzzle, it does not make published solutions or automated correct answering impossible.

## Release helpers: validate, deploy, check, enable

The scripts in `scripts/` reduce setup to one explicit deployment command after the owner supplies a real project. They never print credential values, and the deploy helper keeps browser cloud configuration unchanged until anonymous API checks pass and the public Auth settings confirm that Google is enabled.

Provide these variables through your terminal/secret manager, not through a committed file:

| Variable | Source |
| --- | --- |
| `SUPABASE_PROJECT_REF` | The existing project's20-letter reference |
| `SUPABASE_ACCESS_TOKEN` | Supabase account access token with access to that project |
| `SUPABASE_DB_PASSWORD` | That project's database password |
| `RAVEN_SUPABASE_PUBLIC_KEY` | Public publishable key or legacy **anon** JWT from project settings |

The project URL is derived from the reference. A separately supplied `RAVEN_SUPABASE_URL` must match it. Google client ID/secret are configured in Supabase's provider dashboard, not in this frontend or deployment script. No service-role key is required on the operator's command line.

From the repository root:

```sh
# Read-only prerequisite report; does not deploy or edit browser configuration.
node raven/terminal-preview/supabase/scripts/deploy-cloud.mjs --use-npx

# Verify target ownership, apply the migration, deploy the API, check it, then enable public config.
node raven/terminal-preview/supabase/scripts/deploy-cloud.mjs --use-npx --apply
```

`--use-npx` uses pinned Supabase CLI2.121.0. If the CLI is installed, omit that option. An existing verified binary can be selected with `--cli /absolute/path/to/supabase` or `SUPABASE_CLI_BIN`. The helper rejects ambiguous project/branch names and mismatched URLs; it verifies the requested project is accessible before deployment. CLI subprocess output is withheld on failure to avoid echoing credentials. Successful deployment still requires publishing the changed static file and verifying real Google login.

For an already deployed backend, independent checks and configuration are available:

```sh
node raven/terminal-preview/supabase/scripts/check-cloud.mjs --url https://YOUR_PROJECT_REF.supabase.co
node raven/terminal-preview/supabase/scripts/configure-cloud.mjs --url https://YOUR_PROJECT_REF.supabase.co
node raven/terminal-preview/supabase/scripts/configure-cloud.mjs --url https://YOUR_PROJECT_REF.supabase.co --write
```

The configuration command defaults to validation only. `--write` atomically replaces the existing public config. It rejects service-role/secret keys, expired anon JWTs, insecure non-local URLs and URLs containing credentials. `--disable --write` returns the frontend to explicit local-only mode. Local HTTP requires `--allow-local`.

The health checker sends no user bearer token and does not create a run: it checks the anonymous top50 view, rejection of unauthenticated writes, allowed-origin preflight, foreign-origin rejection, and `/auth/v1/settings` using the public API key. `apiReady` reports the API checks separately from `googleProviderEnabled` (`true`, `false`, or `null` when unverifiable). Local API checks allow Google to remain disabled by default; add `--require-google` to require its enabled flag. The deploy helper always requires that flag before updating browser configuration. An enabled provider flag does not verify OAuth credentials or a successful login/callback; those real acceptance checks remain pending.

Credential availability was inspected by names/existence only: no project variables, CLI auth cache or linked project were available at implementation time. A CLI version/help invocation and mocked release tests do not count as a hosted deployment.

## Configure a real project

Needed from the project owner: a Supabase project, its public project URL and publishable/anon key, and a Google OAuth web client. Keep the Google client secret and Supabase service-role key in the Supabase dashboard/server environment; never put them in the browser config or commit them.

1. In Google Cloud, configure the OAuth consent screen and web client. Add the callback shown by Supabase, normally `https://<project-ref>.supabase.co/auth/v1/callback`, as an authorized redirect URI. Enable Google under Supabase Authentication → Providers with that client ID and secret.
2. In Supabase Authentication URL Configuration, use the production site URL and allow the exact return URL:
   `https://iid7oom21.github.io/abdulrhman/raven/terminal-preview/case-017/`
   For local testing also allow `http://127.0.0.1:8786/raven/terminal-preview/case-017/`.
3. Install/sign in to the Supabase CLI. Run the following from `raven/terminal-preview/` using your own project reference. These commands provision the real backend and must be run against the intended project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase secrets set RAVEN_ALLOWED_ORIGINS=https://iid7oom21.github.io,http://127.0.0.1:8786,http://localhost:8786
   supabase functions deploy raven-api --no-verify-jwt
   ```

   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` are provided to hosted Supabase Edge Functions. The function validates every private request's bearer token with Auth itself; disabling the gateway's legacy JWT check does **not** make score mutations anonymous. CORS origins are an additional browser boundary, not the authentication mechanism.
4. Set only these public values in `modules/runtime-config.js`:

   ```js
   export const CLOUD_CONFIG = Object.freeze({
     supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
     publishableKey: 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY',
     functionName: 'raven-api',
     redirectPath: 'case-017/',
   });
   ```

5. Publish the static site and perform the live acceptance checks below. Keep the repository's full directory structure when deploying the Edge function: it imports the shared evaluator from `modules/` and the original canonical case data through it. The Deno dependency graph/type check is verified locally; hosted CLI packaging and OAuth callback delivery still require the configured project.

For a local Supabase stack, `supabase start` and `supabase functions serve raven-api --no-verify-jwt` run from the same directory. Use the local API URL/anon key reported by `supabase status`. Google remains disabled in local `config.toml` until its environment variables and provider setting are explicitly configured. The automated PostgreSQL test below does not require a Supabase account or those credentials.

## API and integration contract

`createCloud(services)` exposes `configured`, `ready`, `getSession`, `getStatus`, `signIn`, `signOut`, `loadSave`, `saveSave`, `acceptRemote`, `resolveConflict`, `enableSync`, `startRun`, `getRun`, `markViewed`, `submitStage`, `revealHint`, `abandonRun`, `publishRun`, `listLeaderboard`, `subscribe` and `destroy`. `mountCloudPanel(host, services)` installs the optional UI and returns its cleanup function.

Set `services.cloud` before creating the investigation engine. Include `cloud.css` in the case UI. All private actions use `POST /functions/v1/raven-api` with a bearer token and JSON `action`, `revision: "case-017-expansion-v3"`; the server derives the owner from the verified token, never from a supplied user ID.

| Action | Fields | Result |
| --- | --- | --- |
| `start-run` | none | Existing active or fresh authoritative snapshot |
| `get-run` | `runId` | Owner's snapshot |
| `mark-viewed` | `runId`, `requestId`, `expectedSeq`, `evidenceId` | Authoritative snapshot and result |
| `submit-stage` | same run fields, `activityId`, `payload` | Evaluated answer and authoritative snapshot |
| `reveal-hint` | same run fields, `activityId`, `level` | Available hint and authoritative snapshot |
| `abandon-run` | run fields | Closed snapshot without publication |
| `load-save` | none | `{revision,payload,updatedAt}` or no save |
| `save-save` | `payload`, `expectedRevision` | Next revision, or HTTP409 on conflict |
| `publish-run` | `runId`, `alias`, optional `published:false` | Chosen publication state and best run |
| `leaderboard` | none; anonymous allowed | `{revision,entries}` with at most50 rows |

Run snapshots are `{status,progress,viewedIds,result?}`. `progress` contains validated `accepted` records and `completedActivityIds`, the server `seq`, hint state/count, wrong count, run ID and server timestamps. Successful submit results include `{ok,valid,correct,accepted,activityId,seq,message}`. Hint results additionally include `hint`. The client must preserve request IDs during a retry and must not apply a historical cached snapshot over newer progress.

Tables: `profiles`, `case_saves`, `runs`, `run_events`, `leaderboard_entries`. RLS grants authenticated users reads of their own records only; there are no client write policies or score-writing grants. All mutating RPCs are service-role-only. The public leaderboard view deliberately projects a restricted set of fields. The database serializes events with row locks and saves with an account/ruleset transaction lock.

## Automated verification

From the repository root, with Node24 and Docker installed:

```sh
node --test raven/terminal-preview/supabase/tests/commands.test.mjs raven/terminal-preview/supabase/tests/cloud-client.test.mjs raven/terminal-preview/supabase/tests/release-tools.test.mjs
node raven/terminal-preview/supabase/tests/database.test.mjs
docker run --rm -v "$PWD:/project:ro" -w /project denoland/deno:2.5.4 deno check raven/terminal-preview/supabase/functions/raven-api/index.ts
docker run --rm -v "$PWD:/project:ro" -w /project denoland/deno:2.5.4 deno test --allow-env raven/terminal-preview/supabase/tests/edge.test.ts
```

- `commands.test.mjs`: all32 server-evaluated activities, real derivative-file SHA-256 bytes, sequence/source gates, hints, invalid vs wrong answers and sanitized accepted payloads.
- `cloud-client.test.mjs`: disabled configuration, PKCE, invalid callback, logout during refresh/API requests, sequence queue, save conflict preservation, serialized CAS saves practice restoration after logout, monotonic retry snapshots, and response-loss/reload idempotency. Network is mocked.
- `database.test.mjs`: **47 assertions against a real ephemeral PostgreSQL16 Docker container**, applying the actual migration. Minimal `auth.users`/`auth.uid()` and role fixtures model Supabase. Tests include RLS, cross-account isolation, forbidden direct writes, CAS, idempotent score updates,32 sequential commits, final-only finish, fixed elapsed time, ranking and opt-in visibility. Database answer fixtures deliberately isolate SQL from puzzle logic; actual answer checking is covered separately by command tests.
- `release-tools.test.mjs`:13 tests for public-key/URL checks, atomic replacement, anonymous health probes, Google-provider readiness, prerequisite reporting, explicit-target ownership, no credential leakage, and enabling browser config only after API/provider checks pass. Deployment and network responses are mocked.
- `edge.test.ts`:9 tests run the actual HTTP handler with mocked Auth/PostgREST calls, covering verified owner binding, private-token rejection, public view restriction, cached/reordered requests, duplicate-request concurrency regression, source gating and request boundaries.

Docker test containers are removed after completion. No hosted database, real Google account, production score or public result is touched by these tests.

## Optional real local-stack integration

`tests/local-stack.test.mjs` runs against an **already started** local Supabase stack with this migration applied and `raven-api` served. It does not start a stack, deploy a hosted service or test Google. Without the explicit opt-in it reports a skip.

```sh
RAVEN_LOCAL_STACK_TEST=1 \
RAVEN_LOCAL_STACK_WORKDIR="$PWD/raven/terminal-preview" \
RAVEN_SUPABASE_CLI=/absolute/path/to/supabase \
node --test raven/terminal-preview/supabase/tests/local-stack.test.mjs
```

The test reads `supabase status --output json` privately and rejects non-loopback API URLs. It creates two random `.invalid` fixture users through the local Auth admin API with email already confirmed, so no email is sent. It signs in with password, exercises both complete32-activity runs through the actual Edge endpoint, verifies owner isolation/RLS, forbidden direct writes, save CAS, scoring/idempotency, stopped completion time and opt-in leaderboard order/visibility. Finally it deletes only its own fixture users, with their associated rows removed by foreign-key cascades. Generated local keys and user tokens are never printed.

A disposable smaller real-component stack is also available when the full Supabase CLI stack cannot start:

```sh
node raven/terminal-preview/supabase/scripts/run-local-stack.mjs
```

It requires these images to be locally available (the runner deliberately does not pull them): `postgres:16-alpine`, `public.ecr.aws/supabase/gotrue:v2.197.0`, `public.ecr.aws/supabase/postgrest:v16.4` and `denoland/deno:2.5.4`. It creates an isolated Docker network, an in-memory PostgreSQL data directory, real Auth/PostgREST services and the actual Edge HTTP handler. A loopback byte-forwarding bridge handles Docker/workspace network separation; Auth and database responses are not mocked. Generated credentials stay in private temporary environment files and process pipes. The runner removes only its own containers, network and temporary files on normal completion, errors, SIGINT or SIGTERM.

This real-component test passed all8 tests, including two complete32-activity runs. It verifies actual Auth/password sessions, PostgREST RLS/RPC behavior and the Deno handler with the full repository mounted read-only. It does **not** verify Google login or official Supabase CLI deployment bundling; the full CLI stack was blocked locally by Docker image-layer disk exhaustion. Hosted deployment remains unperformed.


## Live acceptance still required

After supplying/configuring the service, verify Google login/cancel/refresh/logout in the production origin; save and conflict recovery between two devices; fresh ranked start/resume; a complete32-activity ranked run; retry after network loss without double scoring; publishing/hiding under a chosen alias; and anonymous top50 output without private fields. Check another account cannot load that run or save. Confirm local practice and the existing music continue when cloud is disabled/offline. These hosted flows are pending configuration and must not be reported as already exercised.
