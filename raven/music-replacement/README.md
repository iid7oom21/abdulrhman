# RAVEN — music replacement (staging only)

This draft prepares the soundtrack replacement requested on **9 November 2026**. It does **not** contain the audio yet and **must not be merged into gh-pages** until all new media has been uploaded and checked.

- Received across two batches: 20 MP4 uploads.
- Repeated names with matching reported file sizes: `35529.mp4`, `35530.mp4`, `35531.mp4`.
- Candidates after name-based deduplication: **17**. True audio duplicates are **not yet verified**.
- Current published soundtrack remains 13 tracks under `assets/audio/raven/`.
- The draft player uses 17 new, separate MP3 paths under `assets/audio/raven-replacement/`; old files are retained for rollback.
- Placeholder track titles use the original video filenames, **not verified song titles**.

## Prepare assets without deleting source files

On a PC with Git, PowerShell, FFmpeg and ffprobe installed, check out this draft branch. Place all 17 differently named source MP4 files in one folder. Run:

```powershell
.\scripts\prepare-raven-music.ps1 -SourceFolder 'C:\RAVEN\source-videos'
```

The script checks that all sources exist and contain audio, then extracts high-quality MP3s and writes `raven/music-replacement/conversion-report.json`. It warns about bit-identical decoded PCM sound between videos. It does **not** upload, delete, commit, push or publish anything.

Before committing:
1. Review the report and compare any duplicate-audio warnings.
2. Listen to and rename each placeholder title in `site-audio.js` to the actual song title, where available.
3. Check converted MP3s and sizes.
4. Run: `node tests/music-replacement-manifest.mjs --require-media`.
5. Check the player in a local preview: mobile and desktop, next/previous, queue end, background media focus, download and AR/EN labels.
6. Commit `assets/audio/raven-replacement/` into this branch. Merge the PR into `gh-pages` only after these checks and owner approval.

No existing 13 songs should be deleted until replacement playback is verified on the published site.
