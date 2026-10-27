# Last Call

`last-call/` is the main investigation in the RAVEN preview. `case-017/` remains an archive entry; its original storage and assets are retained. The new case is an Arabic, authored, free single-player investigation with six characters and six stages.

## Boundaries

- The free path is complete, including evidence, hints, interviews and the final report. It makes no AI or payment requests.
- Progress and notes are saved on this browser/device under the preview store's `last-call:v1` key. Clearing browser data removes that local save. Resetting this case does not reset the archived case or film progress.
- This static build is not a trusted competitive or paid backend. Rules and authored story text delivered to the browser can be inspected. Client save normalization protects ordinary continuity, not paid credit or anti-cheat guarantees.
- Optional generative dialogue requires a separate server-validated entitlement and case-state service before activation. No provider key, credit wallet, purchase button, or fake chat endpoint is included here.

## Modules

- `last-call-data.js`: authored evidence, character statements and puzzle descriptions.
- `last-call-engine.js`: pure state transitions and evidence gates.
- `last-call.js` / `last-call.css`: scene inspection, scheduling analysis, time correction, document assembly/comparison, custody ordering, confrontations and report.
- `assets/last-call-cover.webp`: original decorative cover; the playable desk is a labelled reconstruction, not forensic imagery.

Run the engine and release tests with `node --test raven/terminal-preview/tests/last-call-engine.test.mjs raven/terminal-preview/tests/release-assets.test.mjs`. Browser tests use the existing Playwright configuration and a static server rooted at the repository. `last-call.spec.mjs` completes the free case through the visible controls. Regenerate all browser import versions with `node raven/terminal-preview/tools/stamp-release.mjs` after editing, then verify with `--check`.

Puzzle inspirations are genre mechanics: object inspection, time comparison, assembling fragments, tracing custody and contradicting testimony with sources. The characters, case, documents, artwork and puzzle content are original to this implementation; no game assets or puzzle solutions were copied.
