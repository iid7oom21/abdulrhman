# RAVEN 17 — Restore original Episode 01

Proposed change, **not published** until PR merge. Base branch: `gh-pages`.

- User-supplied video: `21928.mp4` inspected locally; 82.081 seconds, 576×1024, H.264 30 fps, AAC audio; SHA-256: `50c88cb28479f3cd639b5129a680757ed59503f314ce6e736654bc26b11c633d`.
- Cloudinary's existing public asset `raven17/episode-1` has duration ~82.0 sec and dimensions 464×848. **Likely the same episode but different encoding; frame-by-frame identity has not been verified.** This change uses that existing asset URL rather than silently recompressing the user's file.
- Display episode 01 = Cloudinary source 1; episode 02 = existing source 2; episode 03 = existing source 3.
- Historical resume progress and personal notes remain keyed to `sourceId`, so previous episode 2/3 positions are preserved.
- Corrects prior `?episode=3` → 2 rewrite and after-credits boundaries.
- Updates all Arabic/English episode counts, SEO descriptions, and episode selection.
- Does **not** change the soundtrack, studio, secret case content or existing episode media.
- Test: `node tests/restore-episode-one.mjs`. Run additional browser smoke tests on 320/390/1366 widths before merging.
