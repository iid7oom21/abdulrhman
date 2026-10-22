# RAVEN terminal preview

An isolated HTML/CSS/JavaScript preview for the cinematic RAVEN entrance and the expanded Fourth Signature investigation: seven chapters, 32 sequential activities, 16 documents, and the existing thirteen tools. The preview keeps production URLs, media, and saved progress separate. Its pages are intentionally `noindex`.

Preview URL: <https://iid7oom21.github.io/abdulrhman/raven/terminal-preview/>.

See [DESIGN.md](DESIGN.md) for the visual system, route map, thirteen tools, story boundaries, audio behavior, and acceptance criteria.

## Run locally

Serve the repository root, not this directory, because the case documents and approved soundtrack are shared source assets:

```sh
cd /workspace/raven-pages
python3 -m http.server 8786 --bind 127.0.0.1
```

Open <http://127.0.0.1:8786/raven/terminal-preview/>. The same directory structure also works under the GitHub Pages `/abdulrhman/` project prefix. Each film and case route has its own static entry file.

## Tests

The suite uses Playwright and a separately running static server. With dependencies installed in the test directory:

```sh
cd raven/terminal-preview/tests
npm install
npx playwright install chromium
npm test
```

To reuse the existing workspace browser/test installation without adding dependencies to this source tree:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright \
PLAYWRIGHT_TEST_MODULE=/workspace/raven-game-tests/node_modules/@playwright/test \
node /workspace/raven-game-tests/node_modules/@playwright/test/cli.js test \
  -c /workspace/raven-pages/raven/terminal-preview/tests/playwright.config.mjs
```

Set `RAVEN_PREVIEW_URL` to test another served preview, such as the published project URL. `RAVEN_BROWSER=webkit` selects WebKit (the CDP byte-budget test skips outside Chromium). `RAVEN_TEST_OUTPUT` and `RAVEN_TEST_REPORT` select the artifact paths; defaults are under `/tmp`. Screenshots and traces are retained on failure. See [tests/RESULTS.md](tests/RESULTS.md) for the recorded verification run.

Audio-policy tests intercept the song with a valid PCM audio fixture and the film with the approved local silent MP4. They verify actual browser playback, continuity, priority, and user preferences without depending on a remote film transfer. They do not review the remote film's artistic content or replace the approved site media.

## Content and state

The original `fourth-signature/case-data.js` and deduction-support rules remain authoritative. The original eight documents are unchanged. E09–E16 are separately labeled, authored materials from a 2026 review. Their duplex handling card B17 has a reverse B17-R which entered review but was absent from the published package. This establishes an incomplete package, not a new culprit or a determined fire origin.

Activities A01–A32 are required in order. The four canonical deductions occur at A08, A14, A26, and A32; only the final accepted activity enables the report. The three existing free-practice cipher tools remain optional. Notes, board links, chronology, and hypotheses remain personal working material. Photo discoveries require explicit activation, paragraph questions cite opened sources, and the resume memo separates progress from personal notes.

Preview storage remains namespaced under `raven-preview:v1`. The expansion uses the new subkey `case-017:expansion-v3`; legacy completion stays preserved under `case` and never unlocks the expansion. Drafts, accepted answers, sourced notes, photo discoveries, hints, errors, timer, and optional-call state survive reloads. Invalid or noncontiguous accepted answers are discarded. Reset clears expansion work only, retaining films, music preferences, and the legacy case. Practice timing pauses when hidden, outside the case, or manually paused.

The approved recording is shared from `fourth-signature/assets/audio/raven-baqi-athar-320.mp3` without recompression. One player survives internal navigation and respects explicit pause. Browser autoplay policy still applies. Actual film sources are unchanged. Call and puzzle audio use the same priority/hold system, never an independent background-song player.

## Closing scene

A newly accepted A32 opens a 14-second authored web cinematic: the accusation gives way to the four source documents, then the 2026 B17-R card and «انكشفت الرواية… وبقي الأثر.». It never grants progress or resolves the fire's origin. Automatic presentation is recorded once per completed run; reloading or restoring a completed save does not interrupt the visitor. Replay is available from the final activity, deductions and report. Skip reveals the closing card and report immediately; reduced motion, quiet mode and Save-Data use that static ending without downloading video. Reset clears the ending markers with the investigation.

The supplied ending is DOM/CSS, not a generated video. [ENDING_PRODUCTION.md](ENDING_PRODUCTION.md) contains the shot direction, copyable generation prompt and exact delivery requirements for a future 12–15-second video. Its separate `assets/case-ending.json` stays `pending`. A ready file must pass byte count, SHA-256 and decoded-duration checks; download/playback failure leaves the web scene and report available. Video starts muted. Explicitly enabled scene audio lowers the existing song through the same player's `duck`/`unduck` API, restores the visitor's chosen volume, and never overrides manual pause. Controls sit below the imagery.

## Media and optional online features

Morse and DTMF are real synthesized signals. SHA-256 is calculated with Web Crypto from the three downloadable SVG derivative files, checked against their manifest. The archival identifier `7A41` is not presented as a cryptographic hash.

New performed dialogue, laboratory channels, and CCTV clips have **not** been supplied. The optional Elias/Adrian call therefore offers a clearly labeled written scene; activities 15–19 use authored, accessible visual/text materials. They are not described as extracted recordings. Exact recording, timing, filenames, and manifest requirements are in [MEDIA_ASSETS.md](MEDIA_ASSETS.md).

The real-media workbench is implemented for those assets: synchronized camera switching and seeking in A16, decoded PCM waveforms and the player's chosen channel offset in A18, and actual sample reversal/source-excerpt comparison in A19. It verifies file sizes, SHA-256 and decoded durations before enabling playback, releases resources on navigation, and uses the existing soundtrack priority system. Written alternatives remain available. Playback never submits an answer or grants progress.

The media preparation tool takes five supplied originals (one master recording, one optional-call recording, three camera clips) and a timed cue sheet. It creates the three audio derivatives without re-performing them, validates exact sample provenance, and stages a manifest plus captions in a new directory. Its complete-release check fails on the current pending manifest. Technical checks do not certify the spoken dialogue or depicted events; these must match the production script. Synthetic test fixtures are temporary and never shipped as production media.

Google sign-in, cloud save, and ranking are implemented behind the disabled public runtime configuration. Local play works without them. Supabase must be deployed and Google OAuth configured before those services are live; see [Supabase deployment documentation](supabase/README.md). No private key belongs in `runtime-config.js`.

Deployment helpers provide a read-only prerequisite check, explicit-project deployment, live API health probes and atomic public configuration. They leave cloud disabled if prerequisites or health checks fail. Google OAuth requires the owner's Supabase project and Google web client; passing local or mocked tests does not mean hosted sign-in is enabled.

Competitive attempts start fresh on the server. The Edge function validates every activity with the shared rules; database transactions enforce sequencing, idempotency, source access, owner isolation, counters, and server timing. Ranking uses fewer hints, then fewer errors, then lower elapsed time. Only a voluntarily published alias is shown. Local saves and client timer values cannot submit a score. This is server validation, not a claim that public puzzle answers are impossible to discover.

Pure engine checks run with `node --test raven/terminal-preview/tests/engine.test.mjs`. Browser tests include a full 32-activity UI journey; backend validation and database checks have separate commands documented under `supabase/`. See [tests/RESULTS.md](tests/RESULTS.md) for what actually ran and any environment limitations.
