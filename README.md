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
