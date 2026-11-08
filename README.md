# RAVEN — continuous soundtrack

> Handoff v2 (2026-11-01): the story «التوقيع الرابع» (The Fourth Signature) and its Case 017 expansion were removed from this copy. No story replaces them. Old `/fourth-signature/` and `/raven/terminal-preview/case-017/` links redirect to the homepage. Everything below describes the remaining interface.
>
> 2026-11-05: the old interface under `/raven/terminal-preview/` was retired. Its pages are now redirects to the homepage (`raven-17/` to `#films`, `zarqa/` to `#next-premiere`). Only `raven/terminal-preview/assets/` stays, because the homepage and `raven/dialogue/` still use its posters, opening film and fonts.

Serve this directory as the web root. `/raven/` is the homepage. The root redirects to the homepage. `raven/index.html` keeps one audio element alive through `site-player.js` while `site-bridge.js` routes the content frame (`raven/content.html`).

Local preview:

```sh
python3 -m http.server 8786 --bind 127.0.0.1
```

Open `http://127.0.0.1:8786/raven/`.

## Written case continuation

`raven/deleted-name/play/` is a generic bilingual case client, with the same persistent soundtrack shell. It receives only the current scene and earned materials from `/api/case/*`. The private story pack, unrevealed scenes and author solution are not included in this branch. GitHub Pages cannot run that API: without a configured server, the client shows an unavailable state and the static opening remains usable. The opening offers continuation only when the server reports a written case available.

Local/private operation is documented on `main` in `docs/CASE-LOCAL.md`. A player may review a minimal opening-choice summary before starting a separate case session; it does not import private notebook entries or technical-dialogue state. There is no provider or payment dependency. New decorative case artwork is stored as preserved PNG originals and smaller WebP atlases; it is not forensic evidence or a reconstruction of the incident.

This basic preview server is suitable for pages and assets. To verify seeking in the local studio videos, use a server that honors HTTP `Range` requests with `206 Partial Content`; the basic Python server used in this review returned `200` and could not complete those seek checks. `tests/visual-scenes.mjs` also expects the site to be served under `/abdulrhman/`, matching its published path.

Public page identities and sharing:

- Home: `https://iid7oom21.github.io/abdulrhman/raven/`
- English home: `https://iid7oom21.github.io/abdulrhman/raven/?lang=en`
- Sitemap: `https://iid7oom21.github.io/abdulrhman/sitemap.xml`

## Site player

`site-audio.js` owns playback state. `TRACKS` lists 13 distinct recordings, `assets/audio/raven/01.mp3` to `13.mp3`. Previous, next, a track picker, mute and volume are available; a track that ends starts the next one and wraps from 13 to 1. Pages start paused; the entry gate's enter button starts playback. Track, volume and mute are remembered (`raven_music_track_v1`, `raven_music_volume_v1`, `raven_music_muted_v1`). A failed file shows a message and stops.

Navigation, dialogs and scrolling never pause or reconstruct the audio. Audible films and teasers temporarily pause the song so their dialogue stays clear; it resumes from the same position unless the visitor paused it. Reloading the browser document or leaving this host is outside uninterrupted playback.

On 2026-11-05 the owner had a former 14th track and its files deleted from the site. The player keeps exactly 13 tracks; do not add a 14th. The older recording «Dark Pop Intimate - Revised» stays at its original path under `fourth-signature/assets/audio/`. That folder now holds only that recording, the Noto Sans Arabic font and the RAVEN favicon.

## Entry gate

`site-entry.js` shows the RAVEN intro film (`assets/intro/raven-intro.mp4`, poster `raven-intro.jpg`) full screen and muted on the first visit in a session, with skip and sound buttons. If the film cannot play, or the visitor prefers reduced motion, the welcome text and the enter button are shown instead. Episode and anchor links open directly.

## RAVEN 17

RAVEN 17 shows all three original episodes. Display numbers and saved media IDs remain 1, 2 and 3; `?episode=1`, `?episode=2` and `?episode=3` open their corresponding films. Saved playback and personal notes remain isolated by the original media ID.

`tests/restore-episode-one.mjs` checks the three-episode manifest and source IDs. `tests/legacy-episodes.mjs` checks navigation, playback progress, notes and language in Chromium. Run it with `node tests/legacy-episodes.mjs` after serving this directory on port 8786, or set `RAVEN_LEGACY_URL` to the served `/raven/` URL. It requires `ffmpeg` to generate a temporary playback fixture; this does not test streaming the original films in full.

## Metadata and recovery

Each public entry includes canonical, Open Graph, Twitter and structured metadata in its initial HTML; the persistent host updates its metadata on navigation and language changes without replacing the audio. The entry HTML exposes a direct-content link if the player module fails, and content loading has a retry action after 12 seconds.

## Saved data from the removed story

Visitors who played the removed story may still have its progress in their browser storage. No remaining page reads, shows or deletes it; other saved data (language, music, film progress, notes) is untouched.
