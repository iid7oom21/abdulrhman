# RAVEN on Render

This directory prepares a **single-instance, written-case service**. The free configuration keeps encrypted recovery checkpoints in the player's browser; the disk configuration keeps saves on an attached persistent disk. These files do not create a Render service or establish an account connection. The public GitHub Pages site remains a separate deployment.

## Reviewed inputs

- Runtime: Node.js 24 on Linux.
- Source: this repository's `main` branch, deployed manually after its tests pass.
- Public website: **only** the exact `SITE_COMMIT` and `PUBLIC_RELEASE` pinned in [`build.mjs`](./build.mjs). The source tree is never the web root. A browser-recovery deployment needs the public player that understands checkpoints; review that player with the server before changing the pin.
- Private story: supplied separately through a Render secret file or secret environment variable. It must never be committed, included in a frontend build, or served as a static file.
- Player progress: choose one of the two modes below and keep a single instance. Sessions are anonymous; this does not provide cross-device accounts.
- AI: deterministic simulation only. The launcher explicitly disables provider calls, regardless of inherited model environment variables. No OpenAI key is needed.

## Deployment configuration

Both YAML files are review templates, **not records of an existing service**. Prefer updating an existing suitable RAVEN service after checking its configuration.

| Template | Mode | Where progress survives a restart |
| --- | --- | --- |
| [`render-free.yaml`](./render-free.yaml) | `RAVEN_RENDER_STORAGE_MODE=browser-checkpoint`; free service, no disk | The browser's latest successfully stored encrypted checkpoint |
| [`render.yaml`](./render.yaml) | Default `disk` mode; Starter service and 1 GB persistent disk | Private save files under `/var/data/raven` |

`render.yaml` requires billable hosting resources. `render-free.yaml` does not add a disk or enable paid AI calls. Check Render's current free-service limits before applying a template; this repository does not purchase resources.

Commands run from the repository root:

```sh
node deploy/render/build.mjs
node deploy/render/start.mjs
```

The build pins the reviewed public commit and verifies the release, 13 music tracks and three episodes before replacing `.render-site`. A failed build preserves the previous export or its recoverable backup. Build output is ignored by Git.

Startup validates the public export and private story before listening on `0.0.0.0:$PORT` (default `10000`). Disk mode stages content and opens existing saves on the mounted disk. Browser mode stages only the private story in a restricted temporary directory and keeps live sessions in process memory; it creates no save files. Missing/invalid content or unsafe storage locations stop startup. `/` and `/index.html` redirect to `/raven/`, preserving the language query. Secure cookies are enabled for Render's HTTPS proxy.

## Free mode and browser recovery

Set `RAVEN_RENDER_STORAGE_MODE=browser-checkpoint` and supply the private content and a stable `RAVEN_CASE_CHECKPOINT_KEY` as Render secrets. The key must contain exactly **64 hexadecimal characters** generated from 32 cryptographically random bytes. Keep it outside Git, public assets, logs and chat, and retain a private backup. Configure the same key after every restart or redeploy; startup never generates a replacement. Losing or changing it makes existing checkpoints unreadable.

The server encrypts and authenticates a session checkpoint after each accepted action. The player must successfully save that checkpoint in browser storage before showing a browser-save confirmation. API responses report `persistence: browser-checkpoint` and `saveStatus: browser-required`; this is not a claim that the server has durably saved progress. After sleep, restart or live-session eviction, the player can restore its last stored checkpoint and continue. The AI technical preview has separate temporary server memory.

Recovery depends on retaining the browser's site data at the same origin. Clearing storage, using a different browser/device or domain, storage denial, or private-browsing cleanup can lose the recovery copy. A browser write failure must leave progress unconfirmed. A reading export contains reached material for reading; it is not an importable recovery checkpoint. The checkpoint contains the session's reached state and action history, not the private story pack or unseen scenes. Treat a checkpoint as a private session credential and do not share it publicly.

The free mode still needs the private story supplied through Render on **every boot**; an old temporary copy is never used as a fallback. `RAVEN_RENDER_EPHEMERAL_DIR` optionally selects a private directory below the operating system's temporary root. Leave it unset for the default. Disk-only mount and data-directory variables are ignored in this mode.

## Private content delivery

Choose one input:

1. Render secret file `raven-case-content.json`, normally exposed at `/etc/secrets/raven-case-content.json`. `RAVEN_CASE_CONTENT_FILE` can select another absolute input path.
2. Secret variable `RAVEN_CASE_CONTENT_GZIP_BASE64`, containing gzip-compressed UTF-8 JSON encoded as base64. Generate and upload it privately; never paste its value into a command log, repository file, or issue.

Set `RAVEN_CASE_CONTENT_SHA256` to the SHA-256 of the **decoded JSON bytes**. If minifying JSON before compression, hash those minified bytes, not the original formatted document. Only disk mode can reuse its validated disk copy when no new input is supplied. Missing or invalid explicitly supplied input must not silently fall back to old content in either mode.

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
- `/healthz` is healthy and `/api/case/config` reports `enabled: true`, the intended content version and the selected persistence: `browser-checkpoint` or `disk-file`.
- `/api/config` reports simulation and disabled provider calls.
- A fresh browser can enter the written case; a deliberate action is still present after a service restart in the same browser. For free mode, first confirm browser storage succeeded, then verify recovery after server memory is lost; also verify that a blocked browser write does not show a save confirmation.
- Cookie flags include Secure, HttpOnly and SameSite. Private content paths, saves, `.git`, and source files return 404.
- The main website, opening, music controls and three episodes remain reachable. The AI technical preview stays separate from written-case progress.

Only after these checks should the GitHub Pages gateway link to the new full-case URL. The written case must not be described as live merely because a build or `/healthz` succeeds.

## Updates and recovery

Disable automatic deployment; review source, public commit and story version together. Preserve a private backup of the content and checkpoint key, and of the disk when using disk mode. Changing a story version leaves old sessions read-only and exportable; it does not silently rewrite their progress. For browser recovery, old checkpoints require the same key and compatible checkpoint format. Restore a compatible source/public/content set together when rolling back, retaining recovery material.

Both modes are intended for a limited playtest. Browser mode bounds live sessions and checkpoint sizes; recovery remains dependent on the browser's latest saved copy. In disk mode, the existing snapshot limit, operation limits and exclusive-write lock remain in effect. After an interrupted disk write, inspect the store and lock before recovery; never delete a lock or reset saves just to make a health check pass. A persistent disk is not a substitute for a separately retained backup.
