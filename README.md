# RAVEN — continuous soundtrack

Serve this directory as the web root. `/raven/` is the homepage and
`/fourth-signature/` is the investigation. Both entry pages use `site-player.js`
to retain one audio element while `site-bridge.js` routes the content frame.
The root redirects to the homepage.

The approved `RAVEN — باقي أثر` MP3 is the owner's October 20 upload
(`47696ad6.mp3`), copied unchanged to
`fourth-signature/assets/audio/raven-baqi-athar-320.mp3`:
SHA-256 `0d0c017891e418684667f5c9242e1d53e1a5acbf4fa69ad186b143feb88f9f2f`.
This 320 kbps / 48 kHz copy preserves more high-frequency detail than the earlier
128 kbps upload, with the same recording and timing and no detected clipping.
Both entry pages and the audio module use release `baqi-athar-2` to refresh cached
players. Both download links serve this recording.
The player attempts audible autoplay, retries after a trusted interaction when
browser policy blocks it, loops the track, and respects explicit pause.
Controls occupy their own bottom row, outside the image/content viewport.

Navigation, evidence dialogs and scrolling never pause or reconstruct the audio.
Audible films and teasers temporarily pause the song so their dialogue stays clear.
When that media stops, music resumes from the same position unless the visitor has
paused it. Muted background clips do not interrupt the soundtrack.
Reloading the whole browser document, opening another tab or leaving this host is
outside uninterrupted playback. The WebsitePublisher domain is a separate site.

Local preview:

```sh
python3 -m http.server 8786 --bind 127.0.0.1
```

Open `http://127.0.0.1:8786/raven/`.

Public page identities and sharing:

- Home: `https://iid7oom21.github.io/abdulrhman/raven/`
- English home: `https://iid7oom21.github.io/abdulrhman/raven/?lang=en`
- Case: `https://iid7oom21.github.io/abdulrhman/fourth-signature/`
- Sitemap: `https://iid7oom21.github.io/abdulrhman/sitemap.xml`

RAVEN 17 now shows two episodes: the original second film is episode 1 and the
original third film is episode 2. Film files remain unchanged. The retired first
film is absent from the catalogue, player tabs and search. Saved playback and
personal notes still use original media IDs 2 and 3, so renumbering cannot attach
the retired film's progress to a different film. Old `?episode=3` links open the
current episode 2. The legacy content/player queries use `episodes-two-1`.

`tests/legacy-episodes.mjs` checks the two-episode legacy player in a real browser:
source identity, resumed playback, original-film notes, final-episode controls,
old-third-link handling, English labels, manual music-off and 320px layout. Run
it with `node tests/legacy-episodes.mjs` after serving the repository; set
`PLAYWRIGHT_TEST_MODULE` to an available `@playwright/test` installation and
`RAVEN_BROWSER=webkit` for WebKit. It requires `ffmpeg` to generate a temporary
native playback fixture; no generated fixture is shipped as film content.

Each public entry includes canonical, Open Graph, Twitter, and structured
metadata in its initial HTML. The content documents canonicalize to those public
entries, and the persistent host updates its metadata on navigation and language
changes without replacing the audio. Keep the entry and content metadata aligned.
The home share image is an unchanged local copy of the approved RAVEN 17 artwork.

The home is indexable; inclusion in search results and refreshed social previews
depend on the crawlers' own schedules. The original WebsitePublisher contact form
remains an external service. Privacy opens the notice already on this page.

Player recovery:

`site-audio.js` owns playback state and safe volume handling; audible autoplay,
trusted-interaction retries, the approved recording, and looping remain enabled.
The sound settings are available on small screens and retain the chosen volume.
The browser's own autoplay and device-volume policies still apply.

The entry HTML exposes a direct-content link even if the player module fails.
Content loading has a retry action after 12 seconds. Route requests made during
loading are reconciled with the document that actually finishes loading. Browser
Back restores saved scroll and focus for elements with stable IDs. None of these
actions reconstructs or pauses the soundtrack.

Homepage case entry (`focus-2`):

The homepage presents one investigation: The Fourth Signature. The film hero
starts the film; the menu leads to the single case section with its silent scene
and one investigation button. Search opens on request. The former mini-case and
highlights rail are no longer rendered; their source assets and the mini-case's
separately saved progress remain intact. Old `#raven-archive` links reach the case.

`site-entry.js` presents a dismissible welcome once per session; case, episode and
anchor links open directly. The optional cinematic sound setting retains the
chosen playback position. Content frames use the host script version to avoid
loading a cached older investigation after navigation from an updated homepage.

Evidence uses readable rows with a document reference, title, opened state and
open action. Full documents remain in the reader; comparisons, answers and saved
progress are preserved. The four-step navigation keeps accessible names and
44px mobile touch targets. Confirming a reset focuses the first question;
cancelling returns to the button that opened the confirmation.
