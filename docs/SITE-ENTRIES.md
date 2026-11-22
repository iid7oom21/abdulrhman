# Static site entries

Routes below are relative to `/abdulrhman/raven/` in the `gh-pages` checkout. The table covers the HTML shipped under `raven/`, including the direct-content fallbacks and old bookmarks. The studio build at the sibling `/abdulrhman/studio/` is outside this tree.

| Route | Visitor access | Case server dependency |
| --- | --- | --- |
| `./` and `content.html` | Public homepage and its direct-content view. `#films` and `?episode=1`, `2`, `3` lead to RAVEN 17. `#studio` opens the behind-the-scenes section. | The homepage works offline from the case server. On load it requests the same-origin read-only session summary; a recognized active case shows a resume card. Episode streams use an external media host. |
| `after-show/` and `after-show/content.html` | Public bilingual games and simulations. The home card opens Last Transmission directly. Choose a game with `?activity=edit&lang=en` or visit the activity lobby. | No case API, account or model key. Saves stay in this browser. Players explicitly hand their cut to the sibling studio. |
| `deleted-name/` and `deleted-name/content.html` | Public interactive opening. The hero and case card open it. | The opening runs in the browser. Its final availability check reads same-origin `/api/case/config`. A static host offers a labelled link to the separate case server and explains that the opening choice must be made again there. |
| `deleted-name/play/` and `deleted-name/play/content.html` | Public entry to the written case. A direct visit with the backend unavailable displays an explanation, a retry, and links to the opening and homepage. | Active play requires the same-origin written-case API. |
| `dialogue/` | Optional technical preview, opened explicitly from the opening. It labels its browser simulation and uses a separate local store. | None on Pages. |
| `investigation-lab/` and `investigation-lab/content.html` | Local review tools. The shell keeps the soundtrack and loads the same content page that direct links use. The tools link appears inside an active connected case. A direct static visit displays the unavailable state. | Case state and materials require the same-origin API. The private board uses browser storage. |
| `deleted-name.html` | Public compatibility redirect to `deleted-name/`. | None. |
| `terminal-preview/`, `terminal-preview/case-017/`, `terminal-preview/zarqa/` | Compatibility redirects to the homepage. | None. |
| `terminal-preview/raven-17/` and its `part-1/`, `part-2/`, `part-3/` | Compatibility redirects to the homepage films section. | None. |

## Repeat the route check

Run in the static checkout with Node, Playwright and Chromium installed.

```sh
CHROMIUM_PATH=/usr/bin/chromium node --test tests/player-entry.cjs tests/case-entry-browser.cjs
```

The entry test serves only the project mount on loopback. Chromium opens and reloads the homepage and opening, follows the hero and cast links, opens the episode chooser and behind-the-scenes navigation, and opens the labelled dialogue preview. It visits the written case and investigation lab directly with no backend and returns to the homepage. Synthetic browser storage covers restoration of a preview draft. External requests are blocked. The case-entry suite separately exercises the end of the opening against missing, disabled and enabled configuration fixtures.

These checks exercise local Pages-style routing. The public CDN, original episode streams and deployed case server are outside their scope.
