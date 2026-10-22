# Expansion verification record

## Two-episode RAVEN 17 release — 2026-10-22

Release `850282e6effbff45` removes the original first film from the catalogue and renumbers original films 2/3 as Parts One/Two (1:55 and 3:58). Cards, posters, static metadata, bilingual copy and navigation agree. Display numbers are separate from original progress IDs, so existing `episode:2`/`episode:3` saves remain with their films; the retired film's save is untouched. The former Part Three route resolves to Part Two without replacing the audio owner or losing query/fragment. A disposed-player guard prevents late playback events from writing a reset position after navigation.

The legacy homepage/player also exposes two episodes, including its search, metadata and after-film controls. Progress and personal notes retain original film IDs; old `?episode=3` opens episode 2. Legacy entry/script versions are `episodes-two-1`. No approved music, film binary or case content was changed.

| Check | Result |
| --- | --- |
| Chromium episode, audio, shell and release-loading scenarios | **23 distinct cases passed** |
| WebKit episode, audio and shell scenarios | **19 distinct cases passed** |
| Legacy two-episode native playback scenario | **Passed in Chromium and WebKit** |
| Release-stamper unit cases | **8/8 passed**; release consistency and diff checks passed |

Episode checks verify exact source/poster/duration identity, first-playing resume positions, watched updates/reload, unchanged retired-film data, original-film notes, final-episode controls, old links, Back, manual music-off and 320px layout. Playback uses temporary/native fixtures with HTTP Range support; fixtures are not published as film content. Initial local-server connection failures were resolved by restarting the server. Non-seekable fixture responses and an asynchronous test navigation assumption were corrected before the final runs.

Reports: `/tmp/raven-two-episodes-chromium.json`, `/tmp/raven-two-episodes-chromium-final.json`, `/tmp/raven-two-episodes-webkit.json`, `/tmp/raven-two-episodes-webkit-fixed.json`, `/tmp/raven-two-episodes-webkit-range.json`. The legacy scenario is retained as `tests/legacy-episodes.mjs`. Visual review at 320, 390 and 1440px confirms two cards with the new numbering and no overflow; captures are `two-episodes-320.png`, `two-episodes-390.png`, `two-episodes-1440.png` in the release artifact folder.

## Beginner investigation guide — 2026-10-22

Release `70ffb86082c1ed7e` adds a short, inline three-step guide, an explicit current-source action, a persistent dismissal preference, a hero reopening button and visible source labels. It introduces no solution values, evidence unlocks, scoring changes or new media. Only an explicit source click marks an available document viewed; drafts and the actual current task survive guide navigation.

| Check | Result |
| --- | --- |
| Chromium expansion, release-loading and new guide scenarios | **12 distinct cases passed**, including the fresh 32-activity journey |
| WebKit new guide scenarios and fresh 32-activity journey | **3/3 passed** |
| Final guide copy/scroll positioning, Chromium and WebKit | **2/2 passed in each engine** |
| Engine and release-stamper tests | **28/28 passed** |

The guide scenarios cover no automatic document opening or solution disclosure, unchanged hints/errors/accepted work, explicit E09 reading, source return, draft restoration after reload, remembered dismissal, keyboard reopening/focus, manual music-off, and a returning A05 investigator reviewing A01 without losing current progress. Layouts at 320, 390 and 1440px have no page overflow and usable controls. Visual review checked the mobile stack and desktop three-column guide; the shell's existing scroll padding keeps its heading below navigation.

Reports: `/tmp/raven-start-guide-chromium.json` (the initial run included one incorrect test assumption that a returning player's guide stays expanded after reader return), `/tmp/raven-start-guide-chromium-final.json` (corrected cases and final presentation), `/tmp/raven-start-guide-webkit.json`, `/tmp/raven-start-guide-webkit-final.json`. Captures: `start-guide-320.png`, `start-guide-390.png`, `start-guide-1440.png` in `/workspace/artifacts/raven-expansion-release/`.

Commit `67f9c7d` was atomically published to both branches; Pages reported `built`. The public case returned HTTP 200 with the expected release and mounted guide. Both guide scenarios passed against the public origin (2/2, 2.9 seconds). Report: `/tmp/raven-start-guide-public.json`.

## Mobile code keyboard fix — 2026-10-22

The activity renderer inferred a numeric keyboard from field names containing `code` or `key`, preventing normal mobile entry of archive references with letters and separators. It now defaults text inputs to `inputmode="text"`, respecting explicitly declared numeric hints and real number fields. Release `6d062d5989d21c42` refreshes the complete module graph; no case facts, validation rules, save schema or approved media changed.

| Check | Result |
| --- | --- |
| Chromium expansion and release-loading regressions | **10/10 passed**, including the full fresh 32-activity journey |
| WebKit new keyboard regressions and full fresh journey | **3/3 passed** |
| Engine and release-stamper tests | **28/28 passed** |
| Release consistency and whitespace | Both passed |

At 320px, the new tests type the UV reference with keyboard events, restore its draft after reload and submit using the opened source. A completed review fixture checks every text/number field, including colon-separated times, archive keys, explicit numeric codes and leading zeros. These browser tests verify input hints, typing and persistence; they do not operate a physical Android keyboard.

Reports: `/tmp/raven-mobile-keyboard-chromium.json`, `/tmp/raven-keyboard-fields-webkit.json`, `/tmp/raven-keyboard-journey-webkit.json`.

Code commit `1a1844c` was atomically published to both branches and GitHub Pages reported `built`. A fresh public case request returned HTTP 200 and the expected release script. Both new mobile-input checks passed on the public origin (2/2, 4.8 seconds), including typed-reference restoration and submission. Report: `/tmp/raven-keyboard-public.json`.

## Returning-visitor loading fix — 2026-10-22

The reported «تعذّر فتح الملف» was reproduced with the previous cached `core.js` and current `case.js`: the missing `caseCompletionKey` export rejects module linking. GitHub Pages returned `Cache-Control: max-age=600`; the page query alone did not refresh relative module imports. Clicking the old Retry reused the rejected entry in the current document's module map, while saved investigation bytes remained intact.

Release `bd8a32b4db729ff9` versions all 43 local module imports, the app/style references in seven static pages, and lazy route CSS. The content-derived stamper hashes shared canonical leaf files without modifying them; `--check` verifies drift without writes. Retry now navigates to a fresh document with a fresh page query while retaining route/language/hash and stored progress. This is cache busting, not immutable hosting of prior releases.

| Check | Result |
| --- | --- |
| Complete Chromium browser suite | **79/79 passed**, 91.9 seconds |
| Complete WebKit browser suite | **78 passed**, one expected Chromium-CDP-only skip, 2.1 minutes |
| Engine, server commands, cloud client and release stamper | **50/50 passed** |
| Deno Edge-handler tests | **9/9 passed**; type check passed |
| Release consistency | `stamp-release.mjs --check` passed |

Four new browser regressions verify consistent HTML versions, ignoring a stale unversioned core across initial/lazy modules and route CSS, real document navigation after a network failure, and recovery from the exact missing-export linking failure. Accepted progress, a personal note, manual music-off and film position survive both recovery paths. Both browsers also completed the full fresh 32-activity UI journey through the ending and report. No storage schema, case revision, canonical document or approved media file changed.

Reports: `/tmp/raven-loadfix-chromium.json`, `/tmp/raven-loadfix-webkit.json`. The release-stamper unit cases cover stable/idempotent versioning, static/dynamic/shared imports, untouched examples/comments, seven HTML entries, dependency/style/canonical-byte changes, read-only checking and failure before writes for an unsupported shared dependency graph.

Commit `25aaab3` was atomically published to both branches and GitHub Pages reported `built`. The public app/core/case/ending modules matched local SHA-256 at release URLs. All five public checks passed: stale-core avoidance, both Retry recovery paths, cross-route media ownership and a fresh 32-activity journey at 320px (25.0 seconds; 25.7 seconds overall). Report: `/tmp/raven-loadfix-public.json`. Visual review at 390px confirms the case hero and entry action render instead of the error screen; artifacts are `loadfix-public-390.png` and `loadfix-public-files.json` in `/workspace/artifacts/raven-expansion-release/`.

## Case ending — 2026-10-22

The ending release adds a 14-second authored DOM/CSS cinematic after newly accepted A32, skip/replay/report actions, run-bound presentation state and optional verified-video playback. No actual finale video has been supplied; `assets/case-ending.json` stays pending. The original case data, approved recording and film files are unchanged.

| Run | Result |
| --- | --- |
| Chromium, all 75 distinct browser cases across the targeted runs | **75 passed**, zero failures/skips |
| WebKit, same cases | **74 passed**, one expected Chromium-CDP-only skip |
| Ending-specific cases, both browsers | **13/13 passed in each** |
| Full fresh 32-activity UI journey at 320px, both browsers | Passed through automatic ending and final report |
| Engine plus cloud-client/server-command regressions | **42/42 passed** |

The ending checks cover actual final submission, forged completion rejection, no asset fetch before eligibility, no automatic replay on restore, reset, skip versus completed state, report access after module failure, reduced motion, quiet mode, keyboard wrap/focus return and the real DOM timeline. A temporary native 14-second H.264/AAC fixture exercises decoded video, mute/unmute, pause/resume, native end, hashing/network failures, hidden-page pause and browser Back disposal. The AAC fixture is silent; it verifies playback ownership, not delivered story performance. No fixture is in production assets.

The same soundtrack element and source continue through navigation. Audible video attenuates only while actually playing; pauses, waiting, failure, close and disposal release attenuation. Separate owner tests cover multiple tokens, changed preferred volume, media holds and explicit music-off. Presentation metadata cannot grant accepted activities or survive replacement with an incomplete/different run. A lazy-import guard also checks the originating run before opening the scene.

Visual review inspected the four source papers at 390px and settled final cards at 320px and desktop. Controls sit below the 16:9 scene, the report remains reachable, and the unresolved-fire/B17-R limits are readable. Captures: `ending-papers-390.png`, `ending-final-320.png`, `ending-final-1440.png` under `/workspace/artifacts/raven-expansion-release/`.

Reports: `/tmp/raven-ending-regression-chromium.json` (58 existing browser checks), `/tmp/raven-ending-regression-webkit.json` (the same 58); `/tmp/raven-ending-report.json`, `/tmp/raven-ending-journey-report.json`, `/tmp/raven-ending-webkit-report.json`, `/tmp/raven-ending-regression-report.json`, `/tmp/raven-ending-regression-webkit-report.json` cover the 13 ending and four expansion scenarios plus targeted reruns after the audible-playing guard. Repeated checks are not counted as additional distinct cases. Hosted Google/Supabase and new performed media remain pending as documented below.

Code commit `c4f6a42` was atomically pushed to `raven-fourth-signature` and `gh-pages`; Pages reported `built`. Browser-fetched SHA-256 matched all eight changed runtime/media-manifest assets. The public fresh 32-activity journey at 320px passed through automatic ending and report in 23.7 seconds; the case/films/episode/home route journey also passed (2/2 checks, 24.3 seconds overall). Report: `/tmp/raven-ending-public.json`; asset checks: `ending-public-files.json` in the release artifact folder. The live finale manifest remains pending, so the public site presents the authored web cinematic.

## Real-media workbench and release tooling — 2026-10-22

The follow-up adds ready-asset playback to A16/A18/A19, production-media preparation and cloud deployment checks. Production recordings remain pending; all generated media below are temporary test fixtures.

| Run | Result |
| --- | --- |
| Chromium full regression | **57/57 passed**, including the fresh 32-activity UI journey at 320px |
| WebKit full regression after the two additional mobile media cases | **58 passed**, one expected Chromium-CDP-only skip |
| Final media suite in Chromium and WebKit | **16/16 passed in each**, including the additional 44.1 kHz output regression |
| Existing engine, command and cloud-client tests | **41/41 passed** |
| Deployment/configuration/provider-readiness tools | **13/13 passed** |
| Media preparation and complete-release validation | **10/10 passed** |
| Real local Auth/REST/database/Edge integration | **8/8 passed**, with two complete 32-activity ranked attempts |

The final media suite decodes actual H.264 and PCM fixtures, switches cameras at a shared position, derives waveform peaks from samples, applies the selected channel offset, reverses actual sample frames and checks excerpts against their declared source range. It rejects invalid hashes, durations and unavailable files; differing excerpt samples are not labeled identical even when the file's own hash is valid. Navigation, hidden-page loading, music ownership and manual pause are exercised. All three ready-media activities are keyboard-operated at 320px.

Decoding/comparison uses 48 kHz independently of device output. A real 44.1 kHz playback context test confirms exact source/excerpt/reversal comparison and playback of 48 kHz buffers in both browsers. The media pipeline verifies full decoding, the 64 MiB per-file bound, camera frames and actual lossless source/derivative samples. Its complete-release check correctly rejects the current pending manifest. No test fixture was added to the production assets.

The cloud release helper checks API boundaries and public Google-provider settings before writing production configuration. A disabled, missing, failed or unauthorized settings response cannot enable the release. An enabled provider flag is not proof of successful OAuth login. The owner confirmed no Supabase project exists yet; hosted configuration and real Google login remain pending.

The official local Supabase startup could not unpack its PostgreSQL image in the Docker daemon's VFS storage (`no space left on device`). A disposable smaller stack then ran real PostgreSQL 16, GoTrue password authentication, PostgREST, and the actual Deno Edge handler with the repository's SQL migration. A local transport bridge forwarded HTTP responses unchanged across the executor/Docker network boundary; Auth and database responses were not mocked. The integration created two confirmed `.invalid` fixture accounts without sending email, completed both 32-activity attempts, and checked account isolation/RLS, rejected direct writes, save CAS, source/stage gates, hints/errors, retries, server timing, opt-in ranking, hiding and abandonment. The runner removes its own fixture infrastructure. This validates the real handler imports and service interactions; official hosted CLI bundling, Google OAuth and device-to-device browser acceptance still require the owner's project.

Reports: `/tmp/raven-release-complete-chromium.json`, `/tmp/raven-release-complete-webkit.json`, `/tmp/raven-media-final-chromium.json`, `/tmp/raven-media-final-webkit.json`. Ready-media visual review captures are `media-a16-320.png`, `media-a18-320.png`, and `media-a19-320.png` in `/workspace/artifacts/raven-expansion-release/`; their camera frames are deliberately synthetic test video. Reviewed layout keeps controls below imagery and waveform labels readable. The A16 readiness copy and A18 clock spacing were corrected after this review.

Code commit `f043b5f` was pushed to both `raven-fourth-signature` and `gh-pages`; GitHub Pages reported `built`. Browser-fetched public workbench, activity, data and runtime-config modules matched local SHA-256 exactly. The fresh 32-activity public journey at 320px then passed in 23.5 seconds, as did the case/films/episode/home navigation test (2/2 checks, 24.2 seconds overall). Report: `/tmp/raven-media-release-public.json`. The published media manifest remains pending and hosted cloud configuration remains disabled, matching actual delivery status.

## Initial expansion baseline

Recorded 2026-10-22 UTC (2026-10-23 in Riyadh) against the repository's static preview on `http://127.0.0.1:8786/raven/terminal-preview/`. These results supersede the pre-expansion 27-test record.

| Run | Result |
| --- | --- |
| Chromium, complete browser suite | **44 passed**, zero failures/skips; 54.7 seconds |
| WebKit, same browser cases across three runs | **43 passed**, zero failures, one expected skip for Chromium-only CDP transfer accounting |
| Full 32-activity journey through public controls at 320px | Passed in Chromium and WebKit, including one rejected answer at every activity and chapter reloads |
| Pure investigation engine | **19 passed**, including stale ranked-response and timer regressions |
| Cloud adapter and server command rules | **22 passed**; combined final Node run **41/41** |
| Final Chromium route/performance smoke after cloud fixes | **4 passed** |
| Chromium first-load transfer after final code changes | **1,371,263 bytes**, below the 1,500,000-byte budget |

The WebKit runs contain 29 shell/investigation/toolkit/audio/helper checks, nine call/media checks, and five expansion/Save-Data checks. Its one skipped case requires Chromium CDP. The host lacked `libGLESv2`; a Debian package was extracted into `/tmp/raven-webkit-deps` and provided through `LD_LIBRARY_PATH`/`LD_PRELOAD`, without installing system packages. WebKit actually launched and executed the tests.

Transfer uses CDP `Network.loadingFinished.encodedDataLength` from a fresh context and local uncompressed server. It includes the short hero, fonts, script/style responses and fetched posters. No song or episode request occurs before eligible interaction. The final four-case smoke covers all direct entries, cross-route destination content, Save-Data and the transfer budget after the cloud retry fixes.

## Investigation, persistence and access

- The full journey uses visible inputs/buttons and actual source readers, not seeded completion or direct calls to solve the engine. It covers UV, ordering, Morse, Caesar, crop/full frame, map placement, logic/encoding tasks, camera-caption controls, DTMF, alignment, reversal, scan repair, columns, real SHA-256 downloads, citations, and the final report.
- Every activity rejects an incorrect result. Empty inputs and unopened required sources do not count as wrong answers. Q03 and Q04 reject incorrect supporting documents and retain canonical support rules.
- Reload at every chapter boundary preserves accepted answers. Drafts, opened hint levels, photo discoveries, notes and explicit music pause survive. Completed tasks show accepted answers read-only.
- Forged four-deduction flags, noncontiguous accepted answers, wrong answers embedded in saves and nonexistent activity keys cannot unlock later evidence or the report. Legacy completion never promotes into the expansion.
- Search, comparison, source pickers, paragraph answers and restored annotations do not expose closed evidence. A regression covers an earlier-run restore dropping a question answer supported by a now-locked document.
- Reset clears the expansion while preserving the old case, film progress and music preferences. Denied local storage retains a usable in-memory session.
- All thirteen tools remain available. Optional training and personal hypotheses cannot solve case deductions. Report printing is invoked only after accepted A32 and print state is cleared after printing.

## Browser and media

- Seven static routes, internal navigation/Back, direct loading and noindex. Case-to-films-to-episode-to-case-to-home checks assert actual destination content and no stale route errors.
- Layout checks at 320, 390, 430 and 1440px; no horizontal page overflow, reachable controls and visible touch targets. The full activity journey also checks overflow at every task at 320px.
- Keyboard UV/reorder/map/scan/column operations, photo discovery, magnifier, comparison tabs, dialog dismissal and focus return. Scene play buttons remain below imagery.
- One unchanged soundtrack element survives route navigation and position is retained. Film, Morse, DTMF and actual call playback hold/release the same audio owner. Explicit manual pause is respected after a hold ends.
- Call eligibility after Q02/E03, idle notice, defer/restore, written scene, replay, actual ended-only listened state, playback rejection/error cleanup and late media-promise disposal.

Audio policy tests use a valid deterministic PCM fixture and an approved local silent MP4. Call tests exercise real browser decoding with an audio fixture; signal tests exercise Web Audio. These tests do not claim the missing performed recordings or camera footage have been delivered, nor do they establish current availability of every external film host.

## Cloud/backend verification

The shared server-command evaluator and browser cloud adapter have passing Node tests. The actual Edge HTTP handler has nine passing Deno tests with mocked Auth/PostgREST, including owner binding and the concurrent duplicate-request race. The actual SQL migration passes **47 assertions** in ephemeral PostgreSQL 16: RLS, cross-account isolation, service-only mutation, CAS saves, idempotent scoring, sequential completion, server timing, leaderboard ordering and opt-in visibility. Deno type-checking passes.

Additional client/engine regressions prevent a pending refresh from resurrecting a logged-out account and prevent historical idempotency responses from replacing newer progress. See `supabase/README.md` for commands, exact fixtures and deployment requirements. No hosted Supabase project, real Google account or public score was touched. Live OAuth, device-to-device saves and ranked browser journeys remain pending actual project configuration.

## Artifacts and visual review

- Chromium report: `/tmp/raven-terminal-test-report.json`; screenshots/traces: `/tmp/raven-terminal-test-results/`.
- WebKit reports: `/tmp/raven-expansion-webkit.json`, `/tmp/raven-call-webkit-final-report.json`, `/tmp/raven-expansion-journey-webkit.json`.
- Current visual artifacts: `/workspace/artifacts/raven-expansion-release/`.

Visual review inspected the current-task viewport at 390px, alignment at 320px, file hashing at 1440px, and report layout. Additional captures cover opening and people/document grid. Isolated screenshots use valid seeded prefixes only to reach the view being inspected; the full journey tests above start fresh. Original case facts, approved films and the soundtrack files have no source changes in this release.

The actual Chromium print export is a two-page A4 PDF. Page two was visually inspected: unresolved-fire limits and the distinct B17-R/2026 appendix are readable without clipping. Artifact: `report.pdf` in the release folder above.

## Published preview verification

Code commit `19d1364` was pushed to `raven-fourth-signature` and fast-forwarded to the existing `gh-pages` deployment branch. GitHub Pages reported a successful build. On the actual public `/abdulrhman/raven/terminal-preview/` origin, the full fresh 32-activity journey at 320px passed in 23.2 seconds, as did the cross-route case/films/episode/home journey. The real derivative files were downloaded and hashed by the public page.

All seven public static routes were then checked through Chromium navigation: HTTP200, noindex, mounted headings, no iframe, no horizontal overflow at 390px, and zero page errors. The original APIRequestContext route check could not connect directly from this executor (`ENETUNREACH`/`ECONNREFUSED`); the browser-based replacement used the functioning browser network path and passed all seven routes. This was an executor transport limitation, not a site HTTP failure. Public artifacts: `/tmp/raven-expansion-public.json`, `public-routes.json`, and `public-case-390.png` in the release folder. The production homepage and original case/media files were not changed by this expansion commit.

## Remaining acceptance

New call performances, CCTV and the master laboratory recording still need delivery and content review. The workbench and derivative preparation are implemented and tested with actual decoded fixtures; the supplied production files must then pass the same validation and story/timing review. The accessible authored alternatives are labeled as such. Exact media requirements are in `MEDIA_ASSETS.md`. Hosted Google/Supabase remain disabled until configured. Physical Android/iOS checks and real-player difficulty/playtime feedback are still useful; automated tests do not establish a 90–120 minute playtime or override browser audible-autoplay policy.
