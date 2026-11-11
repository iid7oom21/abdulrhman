# RAVEN on Render

This directory prepares a **single-instance, written-case service** with a persistent disk. It does not enable model calls, create a Render service, or establish a hosting account connection. The public GitHub Pages site remains a separate deployment.

## Reviewed inputs

- Runtime: Node.js 24 on Linux.
- Source: this repository's `main` branch, deployed manually after its tests pass.
- Public website: **only** `gh-pages` commit `bfabbe4f6d59781aff17e9e84ccd72580c137106`, exported by `build.mjs`. The source tree is never the web root.
- Private story: supplied separately through a Render secret file or secret environment variable. It must never be committed, included in a frontend build, or served as a static file.
- Player progress: private files under `/var/data/raven` on an attached persistent disk. Keep a single instance. This is an anonymous browser session, not a cross-device account or a distributed database.
- AI: deterministic simulation only. The launcher explicitly disables provider calls, regardless of inherited model environment variables. No OpenAI key is needed.

## Deployment configuration

`render.yaml` is a template to review, **not a record of an existing service**. Its Starter service and 1 GB persistent disk are billable Render resources. Check the account's existing service and disk, region, current pricing and owner before creating anything. Prefer updating an existing suitable RAVEN service. A free service without a disk cannot provide the save persistence this configuration promises.

Commands run from the repository root:

```sh
node deploy/render/build.mjs
node deploy/render/start.mjs
```

The build pins the reviewed public commit and verifies the release, 13 music tracks and three episodes before replacing `.render-site`. A failed build preserves the previous export or its recoverable backup. Build output is ignored by Git.

The startup materializes validated private content on the persistent disk, opens the existing saves, and only then starts listening on `0.0.0.0:$PORT` (default `10000`). It refuses missing/invalid content or unsafe storage locations. `/` and `/index.html` redirect to `/raven/`, preserving the language query. Secure cookies are enabled for Render's HTTPS proxy.

## Private content delivery

Choose one input:

1. Render secret file `raven-case-content.json`, normally exposed at `/etc/secrets/raven-case-content.json`. `RAVEN_CASE_CONTENT_FILE` can select another absolute input path.
2. Secret variable `RAVEN_CASE_CONTENT_GZIP_BASE64`, containing gzip-compressed UTF-8 JSON encoded as base64. Generate and upload it privately; never paste its value into a command log, repository file, or issue.

Set `RAVEN_CASE_CONTENT_SHA256` to the SHA-256 of the **decoded JSON bytes**. If minifying JSON before compression, hash those minified bytes, not the original formatted document. On subsequent starts, the validated disk copy can be used when no new input is supplied. Missing or invalid explicitly supplied input must not silently fall back to old content.

`RENDER_API_KEY` is an operator credential used by the deployment environment to contact `api.render.com`. It does **not** belong in this application, its Render service environment, or the repository. Configure it through the operator's secure secret settings, not chat.

## Release verification

Before deployment:

```sh
node --test deploy/render/*.test.mjs
node --test server/ai-dialogue/tests/*.test.js
node server/ai-dialogue/scripts/check-case.mjs --content /absolute/private/raven-case-content.json
```

The last command plays the private story through the engine from every opening and must exit 0: every scene and choice reachable, no dead end, and an ending reachable from every state. Run it on the exact file whose SHA-256 is configured. Give changed content a new `contentVersion`; saves made on other content under the same version are refused at startup.

After deployment, verify the actual Render URL, not GitHub Pages:

- Root opens RAVEN and the public release reports the expected version.
- `/healthz` is healthy and `/api/case/config` reports `enabled: true`, the intended content version and `persistence: disk-file`.
- `/api/config` reports simulation and disabled provider calls.
- A fresh browser can enter the written case; a deliberate action is still present after a service restart in the same browser.
- Cookie flags include Secure, HttpOnly and SameSite. Private content paths, saves, `.git`, and source files return 404.
- The main website, opening, music controls and three episodes remain reachable. The AI technical preview stays separate from written-case progress.

Only after these checks should the GitHub Pages gateway link to the new full-case URL. The written case must not be described as live merely because a build or `/healthz` succeeds.

## Updates and recovery

Disable automatic deployment; review source, public commit and story version together. Preserve a private backup of the content and disk before a release. Changing a story version leaves old sessions read-only and exportable; it does not silently rewrite their progress. Restore a compatible source/public/content set together when rolling back, keeping the save backup.

The file store is for a limited playtest. The existing snapshot limit, operation limits and exclusive-write lock remain in effect. After an interrupted write, inspect the store and lock before recovery; never delete a lock or reset saves just to make a health check pass. A persistent disk is not a substitute for a separately retained backup.
