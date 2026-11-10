# RAVEN soundtrack replacement — 26 songs (prepared 10 November 2026)

**This branch is staging only. It does not contain the audio files yet. Do not merge into `gh-pages` until all media are uploaded and playback tests pass.**

## Verified source files

- Three chat uploads: 30 MP4 attachments total, with three repeated names between the first two batches (`35529.mp4`, `35530.mp4`, `35531.mp4`).
- 27 distinct filenames; 26 distinct **file hashes** after finding `35535.mp4` and `35542.mp4` are byte-identical. Kept `35542.mp4` as the representative.
- Every one of the 26 outputs has a readable AAC audio stream and was remuxed to M4A without re-encoding; metadata was checked via ffprobe.
- Song titles are placeholder IDs because the source MP4s do not contain verified titles.
- The original 13 songs remain in `assets/audio/raven/` for rollback. Do not delete them.

## Install the music without affecting the live website

1. Download `RAVEN_Soundtrack_26_Ready_2026-11-10.zip` from the ChatGPT conversation and extract it locally.
2. Upload all **26 files** from the ZIP folder `assets/audio/raven-replacement/` to the same path on **this branch** (`raven-soundtrack-26-m4a-2026-11-10`) using GitHub's web uploader or Git.
3. Do not upload the ZIP itself in place of the 26 files. Do not merge this PR until the audio is uploaded.
4. Run `node tests/music-replacement-manifest.mjs --require-media` (this currently **fails** until all media are in place).
5. Test real playback on mobile and desktop: each song, next / previous / last-track wrap, pause, audio focus while video plays, Arabic/English labels, and download behavior.
6. Merge only after playback is confirmed and the owner approves. The site will then use 26 AAC-in-M4A files, not the old 13 MP3 files.

The supplied ZIP includes a detailed report in `raven/music-replacement/manifest.json`; its audio assets are the authoritative, already converted output. GitHub's staged `manifest.json` contains the exact filenames the player will request.

## Why M4A?

The original MP4 audio was AAC at approximately 192 kbps. Extracting with stream-copy preserves the original audio instead of degrading it through unnecessary AAC → MP3 lossy transcoding. M4A is compatible with current Chrome, Edge and Safari browsers.

A PowerShell fallback tool is provided as `scripts/prepare-raven-music.ps1`, but **do not rerun** it unnecessarily when the ZIP contains the verified media.
