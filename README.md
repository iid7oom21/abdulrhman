# RAVEN — continuous soundtrack

> **قرار المالك — 2026-11-19:** أُلغي «زرقاء اليمامة» من نطاق RAVEN. لا يُعاد ترويجه أو تطويره أو استيراده من فروع قديمة. الأولوية لقضية «الاسم المحذوف»، ولا بديل جديد معتمد. [قرار النطاق للمساهمين](docs/PROJECT-DECISIONS.md). هذا إعلان قرار في المصدر، وليس إثبات نشر حي.

> Handoff v2 (2026-11-01): the story «التوقيع الرابع» (The Fourth Signature) and its Case 017 expansion were removed from this copy. No story replaces them. Old `/fourth-signature/` and `/raven/terminal-preview/case-017/` links redirect to the homepage. Everything below describes the remaining interface.
>
> 2026-11-05: the old interface under `/raven/terminal-preview/` was retired. Its pages are now redirects to the homepage (`raven-17/` to `#films`; the retired title route now returns to the homepage). Shared files in `raven/terminal-preview/assets/` stay because the homepage and `raven/dialogue/` still use the RAVEN posters, opening film and fonts. The retired title’s poster is removed from the current export.

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

The static opening can retry a failed illustration without reloading the page or resetting its choices and temporary reading notebook. Recovery is optional: the opening still runs if `raven/deleted-name/opening-artwork.js` is unavailable. A visible stalled image offers retry after 20 seconds; retries are manual and never submit game actions or notebook text. The original images remain decorative. `tests/opening-artwork-browser.cjs` checks recovery, language changes, delayed helpers, and preservation of notes in Chromium.

The draft appears inline. Its comparison opens and closes with the same button, which keeps keyboard focus. You can scroll back to Victor’s messages and use “Go to the paper” to return to the paper heading. The selected notebook passage and the comparison’s open or closed state stay in memory during this visit. Reloading starts a new opening and notebook.

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

## Silent atmosphere clips

The homepage's `#raven-atmosphere` section contains three owner-selected artistic clips, separate from case evidence and the original RAVEN 17 films/poster. They are 10-second H.264 renditions with no audio track, under `raven/assets/atmosphere-v1/`, and have matching WebP posters. Playback starts only on request; starting another clip pauses the previous one. Native controls remain usable without the enhancement script. Failed playback offers manual reload, and page hiding or navigation pauses playback. The existing bilingual homepage helper owns labels and status messages without writing game state or storage. Keep the 16:9 composition on narrow screens.

## RAVEN 17 episodes

RAVEN 17 shows all three original episodes. Display numbers and saved media IDs remain 1, 2 and 3; `?episode=1`, `?episode=2` and `?episode=3` open their corresponding films. Saved playback and personal notes remain isolated by the original media ID.

`tests/restore-episode-one.mjs` checks the three-episode manifest and source IDs. `tests/legacy-episodes.mjs` checks navigation, playback progress, notes and language in Chromium. Run it with `node tests/legacy-episodes.mjs` after serving this directory on port 8786, or set `RAVEN_LEGACY_URL` to the served `/raven/` URL. It requires `ffmpeg` to generate a temporary playback fixture; this does not test streaming the original films in full.

The theater uses a native HTML video inside the site frame. Opening an episode link leaves it paused. When playback starts, the player can seek to that episode’s saved time on the same browser. After completion it clears the episode’s position and waits for the viewer to choose replay, the next episode when available, or an exit. The series has one shared poster. The end panel contains text and navigation.

The browser test also serves an HTTP 503 for the selected film before its metadata loads, then supplies a local MP4 on manual retry. It checks recovery with and without saved progress and closing the theater while a film is unavailable. The fixture covers Chromium’s native controls inside the site frame. The production CDN, Safari and physical devices were outside this check.

## Metadata and recovery

Each public entry includes canonical, Open Graph, Twitter and structured metadata in its initial HTML; the persistent host updates its metadata on navigation and language changes without replacing the audio. The entry HTML exposes a direct-content link if the player module fails, and content loading has a retry action after 12 seconds.

## Saved data from the removed story

Visitors who played the removed story may still have its progress in their browser storage. No remaining page reads, shows or deletes it; other saved data (language, music, film progress, notes) is untouched.
