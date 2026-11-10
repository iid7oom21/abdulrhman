# RAVEN soundtrack — 26 M4A candidates (10 November 2026)

## Current state — important

- The **published GitHub Pages player references the existing 13 MP3 files**, which are still hosted under `assets/audio/raven/`. This was restored after PR #120 was merged prematurely, without the audio assets.
- PR #120: https://github.com/iid7oom21/abdulrhman/pull/120 — **MERGED**, but its new 26-song player list was immediately disabled in a corrective commit because the 26 `.m4a` files were absent.
- The 26 AAC-in-M4A soundtrack files were successfully extracted from the user's MP4 uploads, with no re-encoding, and are distributed **as a ZIP file in the ChatGPT conversation**. They have **NOT** been uploaded to GitHub yet.
- 30 source MP4 uploads had 27 distinct file names. `35535.mp4` is byte-identical to `35542.mp4` and is excluded from the active candidate list; there are 26 remaining distinct binary source files. No independent musical-identity comparison is claimed.

## Next deployment steps

1. Extract `RAVEN_Soundtrack_26_Ready_2026-11-10.zip` (prefer the updated v2 package) on your computer.
2. Open the **published branch** `gh-pages` folder `assets/audio/raven-replacement/` at:
   https://github.com/iid7oom21/abdulrhman/tree/gh-pages/assets/audio/raven-replacement
3. Upload the 26 files named in `raven/music-replacement/manifest.json` from the ZIP's `assets/audio/raven-replacement/` folder. **Upload the individual M4A files, not the ZIP.**
4. Confirm all GitHub asset URLs exist and return audio content. Run `node tests/music-replacement-manifest.mjs --require-media` (the media check will fail until the files are present).
5. Once every M4A has been uploaded and checked, switch `site-audio.js` to the 26-track list in `raven/music-replacement/manifest.json`, change the download label/extension to M4A, and set `raven/release.json` `musicTracks` to 26. Mark `audio_file_upload_required: false` only after verification.
6. Verify real playback on phone and desktop, AR/EN labels, previous/next/wrap, media focus and downloads. Keep `assets/audio/raven/*.mp3` untouched for rollback.

**Release rule:** Never activate the 26-track list before the 26 M4A files are hosted. Any premature merge or direct write would break soundtrack playback again.

## Audio-quality note

All source audio is AAC at roughly 192 kbps. The M4A media were created using `ffmpeg -map 0:a:0 -vn -c:a copy`, without lossy re-encoding. Titles use the original numeric filenames because the MP4s have no verified song-name metadata.
