# RAVEN — continuous soundtrack

Serve this directory as the web root. `/raven/` is the homepage and
`/fourth-signature/` is the investigation. Both entry pages use `site-player.js`
to retain one audio element while `site-bridge.js` routes the content frame.
The root redirects to the homepage.

The approved `RAVEN (Dark Pop Intimate - Revised)` MP3 is unchanged:
SHA-256 `05cc47916015d015d080bc48d354d10fa8189cff817101d96a91da039700325e`.
The player attempts audible autoplay, retries after a trusted interaction when
browser policy blocks it, loops the track, and respects explicit pause.
Controls occupy their own bottom row, outside the image/content viewport.

Navigation, evidence dialogs and scrolling never pause or reconstruct the audio.
Reloading the whole browser document, opening another tab or leaving this host is
outside uninterrupted playback. The WebsitePublisher domain is a separate site.

Local preview:

```sh
python3 -m http.server 8786 --bind 127.0.0.1
```

Open `http://127.0.0.1:8786/raven/`.

Public page identities and sharing:

- Home: `https://iid7oom21.github.io/abdulrhman/raven/`
- English home: `https://iid7oom21.github.io/abdulrhman/raven/?lang=en`
- Case: `https://iid7oom21.github.io/abdulrhman/fourth-signature/`
- Sitemap: `https://iid7oom21.github.io/abdulrhman/sitemap.xml`

Each public entry includes canonical, Open Graph, Twitter, and structured
metadata in its initial HTML. The content documents canonicalize to those public
entries, and the persistent host updates its metadata on navigation and language
changes without replacing the audio. Keep the entry and content metadata aligned.
The home share image is an unchanged local copy of the approved RAVEN 17 artwork.

The home is indexable; inclusion in search results and refreshed social previews
depend on the crawlers' own schedules. The original WebsitePublisher contact form
remains an external service. Privacy opens the notice already on this page.

Player recovery:

`site-audio.js` owns playback state and safe volume handling; audible autoplay,
trusted-interaction retries, the approved recording, and looping remain enabled.
The sound settings are available on small screens and retain the chosen volume.
The browser's own autoplay and device-volume policies still apply.

The entry HTML exposes a direct-content link even if the player module fails.
Content loading has a retry action after 12 seconds. Route requests made during
loading are reconciled with the document that actually finishes loading. Browser
Back restores saved scroll and focus for elements with stable IDs. None of these
actions reconstructs or pauses the soundtrack.

Archive experience (`archive-1`, no longer shown on the homepage):

The homepage retains the horizontal film, episodes, and original investigation.
`site-entry.js` presents a dismissible welcome once per session; case, episode,
and anchor links open directly. Entering retries music only when the visitor has
not explicitly paused it.

`raven/assets/raven-archive.js` adds the optional “On the Other Side” mini-case:
four source records, a pointer/touch UV lens with keyboard and text equivalents,
a separate insight-code dialog, and a conclusion supported by the door report.
It establishes a contradiction in an account, not the identity of the thief.
Only explicitly opened records, the discovered code, and the solved question
count toward progress. Local progress is versioned separately from Case 017.

`raven/assets/raven-story-card.js` prepares a 1080×1920 PNG on the device, with
the optional name and actual progress. Names are not submitted or stored. Save
and Share are separate actions; cancelling a share does not start a download.

The optional cinematic sound setting gently changes the tone with scroll depth
and adds a brief tonal accent when the code opens. It uses one audio graph,
retains the chosen volume and playback position, and bypasses processing when
disabled. If Web Audio cannot start, the original media playback is retained.

Homepage and evidence cleanup (`focus-1`):

The Fourth Signature is the only investigation promoted on the homepage.
The additional mini-case and highlights rail are no longer rendered. Their
source files remain available for future reuse; the old `#raven-archive` link
lands at the main investigation entry. One short introduction and a horizontal,
silent scene replace the repeated text panels. Search tools open on request.

Investigation evidence controls use readable titles and document references
instead of miniature paper mockups. The full documents, original evidence,
saved progress, comparisons, and soundtrack keep their existing behavior.
Content frames load with the host script version to avoid showing a cached
older investigation after navigating from an updated homepage.
