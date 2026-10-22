# Verification record

Recorded 2026-10-22 against the local static preview served from the repository root at `http://127.0.0.1:8786/raven/terminal-preview/`.

| Run | Result |
| --- | --- |
| Chromium, complete suite | **25 passed**, 0 failed, 0 skipped; 15.1 seconds |
| WebKit smoke: direct routes, mobile document comparison, three training exercises | **3 passed**, 0 failed; 6.5 seconds |
| Chromium measured first-load transfer, normal motion | **1,281,795 bytes**, below the 1,500,000-byte budget |

The transfer was measured from Chromium CDP `Network.loadingFinished.encodedDataLength`, with an empty browser context and a local server without compression. It includes the seven-second hero, fonts, script/style responses, and fetched posters. The approved song and full episodes had zero requests before interaction. Save-Data and reduced-motion visits kept the hero as a poster.

## Coverage

- Seven independent static routes, noindex tags, no content iframe, internal navigation and browser Back.
- 320, 390, 430, and 1440 px layouts; no horizontal overflow and visible main-page buttons at least 48 px high/wide.
- Original four deductions, rejection of wrong answers and invalid/missing evidence support, the final report's unresolved-fire limits, saved completion.
- PH-06 crop/full frame and keyboard magnifier, scene controls below the image, mobile comparison tabs, document focus return, keyboard reveal of the optional blackout.
- Source-linked notes and highlights across reload, source paragraph reopening, evidence pins/links, personal timeline, sourced hypotheses, and search limited to opened documents.
- All three independent practice answers: `017` (including Arabic digits), Caesar shift `3`, and `RAVEN`; completion feedback persists without modifying case deductions.
- Storage import once, preview/production isolation, reset preserving episode progress, unavailable storage, and malformed saved tool records.
- Browser media playback after interaction, identical audio element and retained position across routes, film priority, resume, explicit pause, volume, ambience settings, and failed soundtrack recovery without blocking evidence access.

Audio integration tests decode a deterministic PCM fixture delivered at the song URL and an approved local MP4 delivered at the episode URL. This tests playback policy and control ownership without a dependency on remote streaming. It does not establish that every external host is currently reachable.

## Visual review and artifacts

Home and case screenshots were captured at all four widths. The 390 px home, 390 px case, 1440 px home, PH-06 inspection, and toolkit overview were inspected. The offscreen photo thumbnail successfully loaded its actual 1672 × 941 source when scrolled into view; the initial full-page capture's blank thumbnail was lazy loading.

This workspace run stores its artifacts at:

- `/tmp/raven-terminal-test-report.json`
- `/tmp/raven-terminal-webkit-report.json`
- `/tmp/raven-terminal-initial-transfer.json`
- `/tmp/raven-terminal-test-results/`
- `/tmp/raven-terminal-webkit-results/`

Screenshots include `photo-inspection-390.png`, `toolkit-390.png`, and `case-390-loaded.png`. The four normal layout tests also save full-page home and case captures in their respective result folders. Set the output/report environment variables documented in the README to retain artifacts elsewhere.

## Release checks

The three episode URLs, Zarqa teaser, and approved public soundtrack each returned HEAD 200 and byte-range GET 206 with the expected MP4/MP3 signatures. Only 32 bytes per remote media file were read for this reachability check. A Chromium run with a simulated `/abdulrhman/` project prefix loaded all seven entries, opened PH-06, and navigated between the case and films with no script errors, HTTP failures, or local requests escaping the project prefix.

A final 390 px visual pass after replacing emoji-prone arrows with monochrome text arrows confirmed the home CTA sits above the audio dock and the toolkit fits without horizontal overflow.

## Scope limits

This record covers the local prototype, not a production deployment. WebKit received the three listed smoke journeys rather than the complete Chromium suite. Automated layout checks do not replace testing on the owner's physical mobile device. Audible autoplay still depends on browser permission and a valid user interaction.
