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
node --test raven/terminal-preview/supabase/tests/commands.test.mjs raven/terminal-preview/supabase/tests/cloud-client.test.mjs
node raven/terminal-preview/supabase/tests/database.test.mjs
docker run --rm -v "$PWD:/project:ro" -w /project denoland/deno:2.5.4 deno check raven/terminal-preview/supabase/functions/raven-api/index.ts
docker run --rm -v "$PWD:/project:ro" -w /project denoland/deno:2.5.4 deno test --allow-env raven/terminal-preview/supabase/tests/edge.test.ts
```

- `commands.test.mjs`: all32 server-evaluated activities, real derivative-file SHA-256 bytes, sequence/source gates, hints, invalid vs wrong answers and sanitized accepted payloads.
- `cloud-client.test.mjs`: disabled configuration, PKCE, invalid callback, logout during refresh/API requests, sequence queue, save conflict preservation, serialized CAS saves practice restoration after logout, monotonic retry snapshots, and response-loss/reload idempotency. Network is mocked.
- `database.test.mjs`: **47 assertions against a real ephemeral PostgreSQL16 Docker container**, applying the actual migration. Minimal `auth.users`/`auth.uid()` and role fixtures model Supabase. Tests include RLS, cross-account isolation, forbidden direct writes, CAS, idempotent score updates,32 sequential commits, final-only finish, fixed elapsed time, ranking and opt-in visibility. Database answer fixtures deliberately isolate SQL from puzzle logic; actual answer checking is covered separately by command tests.
- `edge.test.ts`:9 tests run the actual HTTP handler with mocked Auth/PostgREST calls, covering verified owner binding, private-token rejection, public view restriction, cached/reordered requests, duplicate-request concurrency regression, source gating and request boundaries.

Docker test containers are removed after completion. No hosted database, real Google account, production score or public result is touched by these tests.

## Live acceptance still required

After supplying/configuring the service, verify Google login/cancel/refresh/logout in the production origin; save and conflict recovery between two devices; fresh ranked start/resume; a complete32-activity ranked run; retry after network loss without double scoring; publishing/hiding under a chosen alias; and anonymous top50 output without private fields. Check another account cannot load that run or save. Confirm local practice and the existing music continue when cloud is disabled/offline. These hosted flows are pending configuration and must not be reported as already exercised.
