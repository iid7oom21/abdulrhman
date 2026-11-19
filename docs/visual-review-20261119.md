# Local RAVEN visual review — 2026-11-19

Frontend base: `07ba37b586d2eac5ebf151c2a7d32930c68cef92` on `gh-pages`.
Design branch: `codex/visual-hook-local-20261119`. The reported local revision `dd0aa5d` and `docs/PROJECT-DECISIONS.md` were not available; this branch does not claim to include that other conversation's changes.

The homepage now distinguishes watching the three existing RAVEN17 episodes from entering The Deleted Name. Seven decorative image originals produce twelve measured WebP variants (590,480 bytes). The approved poster, original portraits, archived media, 13 music files and episode identifiers remain intact. Cancelled-work promotion was removed without deleting archival assets.

The opening uses an optional card reader and paper focus mode, with return of keyboard focus and reading position. Cast and rules references follow the first interaction. The existing earned document is copied verbatim into its reading view. New UI guidance does not write, share, save or change game state. `play/app.js`, `reading-tools.js`, `opening-artwork.js`, `case-entry.js`, and both inline opening scripts are unchanged.

Validation on local Chromium: current opening/artwork/entry suite71 pass; existing play suite54 pass; AR/EN at320/390/768/1440; keyboard, reduced motion, image failure/retry, comparison and draft preservation. The new `tests/visual-opening-browser.cjs` checks the presentation against the inspected source. Separate local-server verification covers the new asset allowlist, private-path denial and actual initial case handoff. Music metadata for13 tracks and actual local playback/control tests passed. External film streams were not played end to end. No physical mobile device or screen-reader claim.

The source branch adds only these reviewed public paths to the existing explicit asset allowlist. It does not change the server engine, deployment pin or hosting. No push or live deployment is part of this review.

The owner's subsequent40-task brief prioritizes01/03/17/24/35/40. Its first local batch adds a phone illustration with the approved image fallback, an exact earlier-message reader, three linked panels, a clearly labelled echo of Victor's earlier last sentence and the retained table illustration. The gate action delegates once to the existing opening action; going back does not restart it. `reading-continuity.js` preserves the chosen paragraph, reading anchor and the user's note caret across a language render without repeating inspection events or transmitting anything. `tests/visual-opening-journey-browser.cjs` exercises8 AR/EN ×320/390×touch/keyboard journeys with images and audio blocked. No new conversation, hidden evidence or provider activation is included.

Generated art is atmospheric, never evidence. The asset manifest records measurements and provenance without private story content. Review originals and detailed screenshots/reports are kept outside this public tree.

Rollback: revert this local visual commit on its own branch. Do not reset a shared branch or replace `main` with `gh-pages`. When integrating another conversation's work, compare against both recorded bases and preserve its scene, draft, recipient and state logic.
