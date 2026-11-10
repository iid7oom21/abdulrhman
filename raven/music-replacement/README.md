# RAVEN soundtrack — 24 verified MP3 tracks (10 November 2026)

## Safety status — DRAFT, NOT FOR MERGE

- The published **gh-pages** baseline currently uses the original **13 MP3 tracks** at `assets/audio/raven/`. Keep those files as the rollback fallback.
- PR #118 was merged on 10 November 2026 despite its warning. Another merged staging change subsequently enabled missing M4A references; a corrective change restored the 13-track live player.
- This is an isolated **new staging branch** based on the corrected gh-pages baseline, not a modification to the old merged PR branch.
- The **24 converted MP3s are verified locally but have not been committed to this branch**. Until media is uploaded, the 24-track staged player would fail playback; DO NOT MERGE.
- No case episodes or main site layout have been modified by this staging change.

## Original source inspection

- Recovered and inspected **30 MP4 upload copies**; **27 distinct source filenames**.
- File SHA-256 confirmed exact duplicates: `35535.mp4` equals `35542.mp4`, plus repeat uploads `35529(1)`, `35530(1)`, and `35531(1)`.
- Chromaprint **and aligned waveform correlation** confirmed two more duplicate musical recordings:
  - `35528.mp4` matches `35529.mp4` (similarity ~0.982; waveform correlation ~0.95–0.96).
  - `35487.mp4` matches `35486.mp4` (similarity ~0.972; waveform correlation ~0.998).
- The retained **24 audio tracks** were converted with FFmpeg/LAME VBR `-q:a 2`. All 24 decoded in full without codec errors. They total approximately **142.35 MB**, about **104 minutes**.
- Original source format: AAC 48 kHz stereo at around 192 kbps. Encoding to MP3 is lossy and does not improve source fidelity; this matches the MP3 delivery request.
- Numeric song labels are placeholders; no musical titles were verified.

## Upload and validation on staging only

1. Extract `RAVEN-Music-Stage-24.zip` on your computer.
2. Copy all **24 individual MP3 files**, preserving directory structure, to `assets/audio/raven-replacement/` on this **staging branch**, not `main` or `gh-pages`.
3. Run `node tests/music-replacement-manifest.mjs --static-only` to check source references.
4. Run `node tests/music-replacement-manifest.mjs --verify-local` after MP3 files are present. This validates the expected file size and SHA-256 from `manifest.json`.
5. Test the actual RAVEN player with hosted media on desktop and mobile, including previous/next, wraparound, track changes, downloads, audio pause during video playback, persistence across navigation and Arabic/English labels. Run the existing player tests.
6. Only after ALL media is committed and actual playback passes should `manifest.json` `audio_file_upload_required` become `false` and the strict gate `node tests/music-replacement-manifest.mjs --require-media` be run.
7. **Ask the owner for explicit approval** before merging into `gh-pages` or publishing. Do not delete the original 13 MP3 files.

**The staging branch contains no new MP3 binaries yet. The strict release test must fail until upload and approval.**
