# RAVEN visual publication — 2026-11-07

The existing homepage displays the four generated scene images and 24-second film inside its existing behind-the-scenes section (`#studio`). The full studio is available at `/abdulrhman/studio/` and uses the same assets. Both landscape and portrait exports support playback, sound and scene navigation. Arabic and English remain supported.

Build source: `ea0987178721ddf0dd00ad96fc3d3566d3a0f5b9` on main. Build command: `npm run build -- --base=/abdulrhman/studio/`.

Copied only `dist/index.html`, `dist/assets/` and `dist/visual-lab/` into `studio/`. The old `dist/raven/` snapshot was not published. All pre-existing homepage markup remains byte-identical after removing the new visual block and its two asset tags. The story, dialogue, approved text packs, episode manifest, notes and original media remain unchanged.

Validation: production build passed; `tests/visual-scenes.mjs` passed at the GitHub Pages path prefix on desktop and 390/320px layouts; `tests/restore-episode-one.mjs` and `tests/legacy-episodes.mjs` passed, including original episode IDs, playback/resume, notes, deep links, language and soundtrack-off state.
