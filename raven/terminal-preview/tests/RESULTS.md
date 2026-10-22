# Expansion verification record

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

## Remaining acceptance

New call performances, CCTV, laboratory audio channels and same-source audio derivatives still need delivery and actual-media integration checks. The accessible authored alternatives are labeled as such. Exact media requirements are in `MEDIA_ASSETS.md`. Hosted Google/Supabase remain disabled until configured. Physical Android/iOS checks and real-player difficulty/playtime feedback are still useful; automated tests do not establish a 90–120 minute playtime or override browser audible-autoplay policy.
