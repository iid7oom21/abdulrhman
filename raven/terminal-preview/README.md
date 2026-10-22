# RAVEN terminal preview

An isolated HTML/CSS/JavaScript prototype for the cinematic RAVEN entrance and the Fourth Signature investigator toolkit. The preview keeps production URLs, media, and saved progress separate. Its pages are intentionally `noindex`.

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

The original case data and deduction-support rules remain authoritative. The three cipher exercises are labeled practice and do not affect case completion. User notes, board links, chronology, and hypotheses are personal working material, not verified conclusions.

Preview storage is namespaced under `raven-preview:v1`. Valid old progress can be copied once into the preview; the production keys are never changed. Audio remains browser-policy dependent: one eligible click or key interaction starts the song, and an explicit pause remains respected.

The approved recording is shared from `fourth-signature/assets/audio/raven-baqi-athar-320.mp3` without recompression. Video/picture sources are the owner's approved assets. No mailing-list service, launch date, new secret recording, or new story evidence is fabricated by the preview.
