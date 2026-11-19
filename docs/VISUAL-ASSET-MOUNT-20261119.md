# Local visual asset mount

Base `main`: `4acce380d563792bf7cab76a382356c01aef253c`.
Branch: `codex/visual-hook-source-local-20261119`.

`server/ai-dialogue/src/site-mount.js` adds six explicit frontend CSS/JS files and twelve decorative WebP exports for the separate local frontend review branch, including the first batch of the owner's40-task addendum. No wildcard static serving, private pack exposure, API, state engine, model configuration, deployment pin or service change.

Validation: existing site-mount suite11 passed. The local case server served all15 new paths with bytes matching the frontend and denied9 private/traversal probes. Four AR/EN initial handoffs at390/1440 passed; a separate reload check preserved the initial case session, revision, scene and earned material IDs. Provider calls remained disabled. These tests are local, not production verification.

The three addendum paths also returned200 with bytes identical to disk, and the site-mount suite11 was rerun successfully after the allowlist extension. The local server was restarted with the same isolated test-data folder; no production service was touched.

Revert this change independently of the frontend commit. Keep source and frontend branches separate; use the local launcher's explicit `--site` path to review them together.
