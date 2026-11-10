# RAVEN soundtrack — 32 prepared AAC/M4A tracks (10 November 2026)

## Verified status

The currently published player still uses **13 working MP3s** in `assets/audio/raven/`. Keep it that way until the replacement music is hosted and playback-tested.

Four upload batches supplied 40 MP4 attachments. Repeated uploads across batches have been removed; 33 distinct filenames yielded **32 byte-distinct audio-source files** because `35535.mp4` and `35542.mp4` are identical. The newest 10 attachments included 4 exact reuploads (`35489`, `35490`, `35504`, `35519`) plus **6 new tracks** (`35512`, `35513`, `35514`, `35515`, `35517`, `35518`). The six new sources have valid AAC audio; chromaprint comparisons found no close musical duplicates among the 32 prepared candidates (not a formal proof of different songs).

**Prepared delivery:** `RAVEN_Soundtrack_32_FINAL_2026-11-10.zip` in the ChatGPT conversation contains all 32 AAC/M4A media files, `raven/music-replacement/manifest.json`, a tracklist, and verification data. The 32 audio files **are not uploaded to GitHub yet**.

## Deployment gate — do not skip

1. Unzip the package locally.
2. Upload all **32 individual .m4a files**, not the ZIP, to `assets/audio/raven-replacement/` in the GitHub repo `iid7oom21/abdulrhman`. Do not alter or delete `assets/audio/raven/`.
3. Verify the exact 32 paths and file integrity (all >4 KB), then run `node tests/music-replacement-manifest.mjs --require-media` on the branch holding all 32 media files.
4. In a **separate activation change**, update `site-audio.js` from the working 13 MP3s to the 32 M4As listed in the manifest, download labels from MP3 to M4A, and `raven/release.json` `musicTracks` from 13 to 32. Update tests accordingly. Do **not** flip `audio_file_upload_required` to false before the media is confirmed.
5. Verify actual playback in a browser on phone and desktop, Arabic/English labels, next/previous/end-of-queue wrapping, focus changes during video playback, and download links. Merge/publish only after owner approval and testing.

Existing `gh-pages` playlist is safe to leave unchanged during these preparations. No claim of live publication is made.

## Format

All music is extracted as AAC in M4A containers via FFmpeg stream copy (`-map 0:a:0 -vn -c:a copy`), avoiding additional lossy re-encoding. Numeric labels are placeholders; the source videos have no verified song titles.
