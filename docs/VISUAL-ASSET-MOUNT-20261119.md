# Local visual asset mount

Base `main`: `4acce380d563792bf7cab76a382356c01aef253c`.
Branch: `codex/visual-hook-source-local-20261119`.

`server/ai-dialogue/src/site-mount.js` adds ten explicit frontend CSS/JS files and twelve decorative WebP exports for the separate local frontend review branch, including the first batches of the owner's40-task addendum and later thirty-idea brief. No wildcard static serving or private pack exposure. The four latest paths are homepage resume CSS/JS and private-reflection CSS/JS.

Validation: existing site-mount suite11 passed. The local case server served all15 new paths with bytes matching the frontend and denied9 private/traversal probes. Four AR/EN initial handoffs at390/1440 passed; a separate reload check preserved the initial case session, revision, scene and earned material IDs. Provider calls remained disabled. These tests are local, not production verification.

The three addendum paths also returned200 with bytes identical to disk, and the site-mount suite11 was rerun successfully after the allowlist extension. The local server was restarted with the same isolated test-data folder; no production service was touched.

The later batch adds `GET /api/case/resume-summary` after the existing session authentication check. It returns exactly schemaVersion, caseId, contentVersion, resumable, persistence and saveStatus. It neither creates nor restores a session and returns no scene, notes, materials or checkpoint credential. Unavailable sessions return401; read-only or unconfirmed state does not claim resumability. Seven new endpoint tests and23 existing restart/checkpoint/failure tests passed. The state engine, model configuration, deployment pin and service settings remain unchanged.

Final verification after all22 asset additions: site-mount11/11 passed with local Chromium, all four latest files returned exact frontend bytes, and a390px browser journey started a real local session before returning to the homepage. Anonymous requests kept the resume card hidden; authenticated Arabic/English links worked without exposing private content. An initial test invocation omitted `CHROMIUM_PATH` and could not launch the browser; the corrected invocation passed. No production-service claim follows from these local checks.

Revert this change independently of the frontend commit. Keep source and frontend branches separate; use the local launcher's explicit `--site` path to review them together.
