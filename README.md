# RAVEN — continuous soundtrack

> Handoff v2 (2026-11-01): the story «التوقيع الرابع» (The Fourth Signature) and its Case 017 expansion were removed from this copy. No story replaces them. Old `/fourth-signature/` and `/raven/terminal-preview/case-017/` links redirect to the homepage. Everything below describes the remaining interface.

Serve this directory as the web root. `/raven/` is the homepage. The root redirects to the homepage. `raven/index.html` keeps one audio element alive through `site-player.js` while `site-bridge.js` routes the content frame (`raven/content.html`).

Local preview:

```sh
python3 -m http.server 8786 --bind 127.0.0.1
```

Open `http://127.0.0.1:8786/raven/`.

Public page identities and sharing:

- Home: `https://iid7oom21.github.io/abdulrhman/raven/`
- English home: `https://iid7oom21.github.io/abdulrhman/raven/?lang=en`
- Sitemap: `https://iid7oom21.github.io/abdulrhman/sitemap.xml`

## Site player

`site-audio.js` owns playback state. `TRACKS` lists 13 distinct recordings, `assets/audio/raven/01.mp3` to `13.mp3`. Previous, next, a track picker, mute and volume are available; a track that ends starts the next one and wraps from 13 to 1. Pages start paused; the entry gate's enter button starts playback. Track, volume and mute are remembered (`raven_music_track_v1`, `raven_music_volume_v1`, `raven_music_muted_v1`). A failed file shows a message and stops.

Navigation, dialogs and scrolling never pause or reconstruct the audio. Audible films and teasers temporarily pause the song so their dialogue stays clear; it resumes from the same position unless the visitor paused it. Reloading the browser document or leaving this host is outside uninterrupted playback.

The older recordings «باقي أثر» (`raven-baqi-athar-320.mp3`, `raven-baqi-athar.mp3`) and «Dark Pop Intimate - Revised» stay at their original paths under `fourth-signature/assets/audio/` so existing links keep working. That folder now holds only shared audio, the Noto Sans Arabic font and the RAVEN favicon.

## Entry gate

`site-entry.js` shows the RAVEN intro film (`assets/intro/raven-intro.mp4`, poster `raven-intro.jpg`) full screen and muted on the first visit in a session, with skip and sound buttons. If the film cannot play, or the visitor prefers reduced motion, the welcome text and the enter button are shown instead. Episode and anchor links open directly.

## RAVEN 17

RAVEN 17 shows two episodes: the original second film is episode 1 and the original third film is episode 2. Saved playback and personal notes keep original media IDs 2 and 3. Old `?episode=3` links open the current episode 2.

`tests/legacy-episodes.mjs` checks the two-episode player in a real browser. Run it with `node tests/legacy-episodes.mjs` after serving this directory; set `PLAYWRIGHT_TEST_MODULE` to an available `@playwright/test` installation. It requires `ffmpeg` to generate a temporary playback fixture.

## Metadata and recovery

Each public entry includes canonical, Open Graph, Twitter and structured metadata in its initial HTML; the persistent host updates its metadata on navigation and language changes without replacing the audio. The entry HTML exposes a direct-content link if the player module fails, and content loading has a retry action after 12 seconds.

## Saved data from the removed story

Visitors who played the removed story may still have its progress in their browser storage. No remaining page reads, shows or deletes it; other saved data (language, music, film progress, notes) is untouched.

## Published-site design continuation (2026-11-02)

The deployed website is on **`gh-pages`**, not `main`. The React creative studio on `main` is a different interface; do not replace the published RAVEN site with its build.

The current presentation adds the existing series title and description below the complete hero artwork, keeps the episode action, adds a direct teaser link, and reduces the closed mobile music bar to 112 pixels at 320, 390, and 600 pixels in both languages. Its soundtrack element, 13 recordings, opening film, two episodes, saved progress/notes, translations, and original artwork are retained. `raven/assets/raven-continuation.css` contains the homepage styling; the corresponding mobile player rules are at the end of `site-player.css`.

The unmerged `codex/raven-last-call` branch is separate historical work. This continuation does not merge it or restore the deliberately removed Fourth Signature/Case 017 story.

Validation for this continuation: the existing homepage redesign check and legacy episode playback/resume check pass; all 8 release-asset unit tests pass. Additional browser checks cover both hero actions, both languages at six viewport widths (320–1440px), all 13 tracks, mobile audio settings, and retention of the same soundtrack element through navigation. Artwork hashes remain unchanged. Remote hero and card artwork loaded directly in the review browser; episode playback regressions use the existing temporary fixture and do not certify remote stream availability.
