# Investigation tools — local review

The review room reuses the existing written-case player, action preview, revision checks and encrypted browser checkpoints. It does not add a second story engine or publish a case pack. The normal player links to `/raven/investigation-lab/` when the matching frontend files are installed.

The room adds a text inspector (zoom and contrast), private connections between acquired materials, and written navigation hints. Connections are player questions or hypotheses, not established contradictions. Hints use only currently displayed action labels; neither tool unlocks evidence, sends a report, grants character knowledge or calls a model. The green contrast pulse is a reading effect, not a forensic finding, and respects reduced motion.

## Start locally

Use Node.js24 and the reviewed `gh-pages` checkout containing `raven/investigation-lab/`. Keep the content and review data outside Git and the public site:

```bash
node server/ai-dialogue/scripts/start-investigation-lab.mjs --content /private/case.json --site /public-site --data /private/review-data
```

Open `http://127.0.0.1:10001/raven/investigation-lab/` on the same machine. The launcher binds to loopback, fixes the provider to simulation, and disables external model calls regardless of inherited provider credentials. It creates a private recovery key once; keep it with the review data. Invalid existing keys fail without replacement. This is a local preview, not a deploy command.

Case progress is encrypted by the server and retained in the current browser. Private board connections are a separate browser-only document, scoped by case, content version and an opaque session tag. They are never included in case actions or reports. Storage failure must not be described as a successful save. Corrupt or conflicting board copies are preserved for review. Without a stable session identity the board cannot safely bind notes to a player; inspection and navigation can still work. Downloaded copies contain private player text and should not be uploaded to public CI or analytics.

The lab uses separate pending-operation/checkpoint keys and does not import the other page's opening choice. Returning to the regular player uses the current server session. A static GitHub Pages host cannot execute `/api/case/*`; the existing unavailable-server state remains visible when no case server answers.

## Server-side character context

`server/ai-dialogue/src/interrogation-context.js` is a pure projection module, not an enabled dialogue API. `buildInterrogationContext(pack, state, policy, actorId, options)` accepts only an engine-owned state and a trusted private policy for the exact case/content version. Actor knowledge and explicitly received player materials remain separate. Disclosure/permission gates run before source text enters the result. User questions and source text remain untrusted data.

The result references source IDs, separates received and own sources, and carries a private cache identity scoped by session, actor, revisions, language and inputs. Never expose raw private policies or pass browser-supplied state as authority. Do not serialize cache metadata into model input. `buildInvestigationHint(projected)` returns only available action/material IDs from an engine projection; it performs no deduction or state transition.

No live provider, new character voice or psychological profile is enabled by this module. A future integration requires approved character knowledge/disclosure policy and bounded provider evaluation. Do not add automatic paid-provider fallback to an operation whose outcome is unknown.

## Verify

In the backend checkout:

```bash
node --test server/ai-dialogue/tests/interrogation-context.test.js server/ai-dialogue/tests/investigation-lab.test.js
npm test
```

In the frontend checkout, using the existing Playwright installation and Chromium executable:

```bash
CHROMIUM_PATH=/usr/bin/chromium node --test tests/investigation-workbench-browser.cjs
CHROMIUM_PATH=/usr/bin/chromium node --test tests/case-play-browser.cjs tests/case-checkpoint-browser.cjs
```

Fixtures are invented, not the private case. Keep real-story path reports and character-policy evaluations outside the checkout. Tests cover specific boundaries; passing them does not prove every story path, every browser or live-model behavior.
