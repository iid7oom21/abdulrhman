# RAVEN — cinematic entrance, investigative workspace

This specification covers the isolated `terminal-preview` prototype. It preserves the approved RAVEN artwork, the owner's **باقي أثر** recording, and the original Fourth Signature evidence and solution. The prototype is not a replacement for the production homepage until it has been reviewed.

## Experience and visual system

The homepage is a cinematic entrance. The investigation is a working archive. The visitor can watch the films without learning the case, and investigate without being required to use every tool.

- Palette: near black `#080a0b`, warm ivory `#eee8de`, restrained gold `#d6b98d`, and aged paper for documents.
- Typography: local IBM Plex Sans Arabic for reading; Cinzel for the Latin RAVEN identity. Body text 17–19 px, labels at least 14 px, comfortable line height. Do not add letter spacing to Arabic text.
- Interaction: controls outside the image, touch targets at least 48 px where practical, visible keyboard focus, sufficient contrast. A dark background must not make the copy faint.
- Motion: a short muted landscape hero, faint CRT scanlines confined to the investigative atmosphere, and optional quiet mode. Reduced motion and data-saving connections should get a poster instead of automatic video.
- Terminal texture: a restrained nine-second desktop frame glow rather than rapid flashes. Reduced motion and quiet mode suppress scanlines and animation. A short heading reveal is decorative; source documents remain immediately readable.
- Classified text: the optional opening-line blackout reveals on hover or keyboard focus and can be pinned open by a tap or Enter. Essential evidence is never concealed behind this effect.
- First screen: approved cinematic image, “أفلام غموض وتحقيقات تفاعلية”, and “شاهد RAVEN 17”. No mandatory introduction or audio gate.
- Film cards: three visible parts with actual durations 1:22, 1:55, and 3:58. Their playback preserves the portrait aspect ratios of the actual films. Completion and resume are separate states.
- Zarqa Al-Yamama: the existing 16-second teaser, “قيد التطوير”, and the official follow link. There is no confirmed release date or countdown.

## Information architecture

Static entry files make each route independently reloadable on GitHub Pages:

| Route, relative to the preview | Purpose |
| --- | --- |
| `/` | Cinematic homepage and visible film cards |
| `/raven-17/` | Series overview and three parts |
| `/raven-17/part-1/` to `/part-3/` | Individual film, resume and watched state |
| `/zarqa/` | Upcoming film and existing teaser |
| `/case-017/` | The Fourth Signature archive, deductions, and tools |

Internal navigation replaces the route outlet while retaining the audio owner. Browser Back/Forward, direct links, focus, and scroll restoration remain part of the navigation contract. Public interface text supports Arabic and English. The actual case documents are Arabic and the language is stated clearly.

## Investigator toolkit: 13 useful actions

| Tool | Behavior and evidence boundary |
| --- | --- |
| Magnifier | Inspect the existing PH-06 or padlock image at up to 2×. Never swap in an invented fingerprint or a different image. |
| Crop context | Compare the report crop with the full PH-06 frame and toggle the crop outline. |
| Compare | Two source documents on desktop; accessible tabs on mobile, each retaining its reading position. |
| Highlight | Mark and unmark a paragraph as an excerpt from the source. |
| Source notes | Save an observation, hypothesis, or question with evidence ID, paragraph index, and original quotation. |
| Evidence board | Pin viewed evidence, move it, connect two items, label the relationship, and optionally state a reason. Provide a list alternative. |
| Timeline | Arrange sourced excerpts in before-fire, after-fire, reopening-2026, or unspecified buckets. Do not create precise times or pretend that the player's arrangement is verified. |
| Search | Search and filter opened documents only. Search must not index correct answers, explanations, or the ending. |
| Hypotheses | Collect the visitor's claims with supporting or contradicting sources. Feedback confirms saving, not correctness. |
| Final report | After all 32 activities and the four original deductions, show the existing reasoning and limits plus a separate 2026 appendix; separate personal notes and allow printing. |
| Morse practice | Play/visualize `017`, with speed, replay, stop, reference chart, and an answer field. |
| Caesar practice | Decode `WKH ILOH LV RSHQ` with a shift of three to obtain `THE FILE IS OPEN`. |
| Number-letter practice | Decode `18-1-22-5-14` to `RAVEN` using an alphabet reference. |

Training is labeled **تدريب المحقق** and its completion does not unlock case evidence or change solved deductions. The board, timeline, and personal hypotheses are optional. The interface presents contextual tools and a tool drawer rather than thirteen controls covering the document.

## Story integrity and source treatment

The authoritative story remains the original eight documents and four deductions. Authentic signatures were placed beneath a statement their signatories had not endorsed. The audit record connects production of the approved report to the authenticated account. The file does not determine the origin of the fire.

- E01 ADM-04: approved administrative report.
- E02 LC-14: delivery receipt.
- E03 MA-22: maintenance request and interim procedure.
- E04 AR-09: initial inventory.
- E05 RC-31: document referral receipt.
- E06 PH-06: photo record and crop comparison.
- E07 AUD-07: document production audit.
- E08 REV-08: reopening record and correspondence.

PH-06 is a visual reconstruction from its preservation card; the written source remains available. Decorative paper stains, stamps, and wear are not clues. Only 2019 and 2026 are established years. Other chronology is relative. The last two deductions retain their existing evidence-support validation.

Source-linked notes preserve a quotation. If the source text later differs, the old quotation remains visible rather than attaching the note to a misleading paragraph. User-created text is rendered as text, not HTML.

## Persistent sound and local state

One soundtrack element owns the unchanged 320 kbps recording. It receives a source only after an eligible user interaction. Explicit pause and volume choices persist within preview storage. Audible films and Morse playback temporarily hold the song; releasing the hold resumes it only when the visitor has enabled music. A first click that starts a film must not briefly start the song too.

Ambient room tone and typewriter effects are independent and off initially. These effects suspend while the document is hidden. View-specific media stops when disposed, while the site's song follows the visitor's playback choice. Documents appear immediately; typing effects must not delay reading.

All new state uses the `raven-preview:v1` namespace. The expansion has its own `case-017:expansion-v3` subkey; legacy case progress remains preserved and never unlocks the new activities. Reset creates fresh expansion state, including notes, board, timeline, hypotheses, call state, and practice badges, while preserving film progress and sound preferences. Storage denial leaves an in-memory session usable.

Each route mounts and disposes its own events/media. The single audio owner survives route replacement. Local investigation needs no account or backend; optional Google/cloud/ranking features require the supplied Supabase deployment. No mailing provider, festival award, or unpublished release date is fabricated.

Browser releases carry one content-derived version through all module imports and entry/route styles. This prevents returning visitors from combining an old cached core with a new route module. The explicit error-page Retry opens a fresh document/module map while keeping saved investigation, film and music state. Normal internal navigation remains within the existing shell and audio owner.

## Expanded investigation: review 2026

The playable path alternates short source reading with concrete manipulations. There is one current activity, three progressive hints per activity, and a review index for completed activities. Reopening a completed activity shows its accepted answer read-only. Controls use buttons/selects and explicit move actions as keyboard and touch alternatives; no puzzle requires dragging alone.

A collapsible three-step beginner guide appears before the activity navigation. It is initially expanded only for a fresh investigation without a dismissal preference, with native keyboard-accessible reopening and a hero shortcut. Copy explains source → inspection → accepted submission, without solution values; a direct source button uses the current task's first unread accessible requirement. A visible source caption distinguishes source buttons from decorative references. Dismissal is a device UI preference independent of case progress, scoring and reset. Existing players return to their current activity without replaying the beginning.

| Chapter | Activities and outcomes |
| --- | --- |
| 1 · Opening the package | A01 duplex UV inspection; A02 fragments and template; A03 Morse and Caesar; A04 missing versus cancelled ledger numbers. |
| 2 · Image and location | A05 crop/full frame; A06 cage lock versus exit latch map; A07 three encodings and cabinet reference; A08 original first deduction. |
| 3 · Signature context | A09 route and word coordinates; A10 symbolic alphabet; A11 logic lock; A12 discriminating document request; A13 signature purposes and attachment/receipt distinction; A14 original second deduction. |
| 4 · Handling and recordings | A15 illustrated handling traces and their limits; A16 camera-event cards; A17 audible DTMF; A18 clock correction and channel alignment; A19 reverse direction and same-source excerpt comparison. |
| 5 · Package recovery | A20 scan-strip restoration; A21 digitwise subtraction and column order; A22 version-key matching; A23 actual file hashes; A24 correspondence order; A25 people/document grid. |
| 6 · Building proof | A26 report assembly and original third deduction; A27 causal chronology; A28 test completeness; A29 proof limits; A30 claim/source/quotation matches. |
| 7 · Closing the review | A31 combined archive address; A32 original fourth deduction, correct B17-R attachment, report and 2026 appendix. |

E01, E06, E09 are initially available. A04 opens E02/E03; A12 opens E04/E05/E08; A14 opens E15; A15 opens E12; A17 opens E13; A18 opens E14; A19 opens E10; A21 opens E11; A23 opens E16; A25 opens E07. Readers, comparisons, search, source pickers, paragraph questions, and notes all honor the same access rules. Future-source question notes are hidden after restoring an earlier state. The source files remain public static assets; access gating is an experience boundary, not secrecy or DRM.

New 2026 materials cannot alter the original documents: E09 envelope, E10 B17 handling card, E11 derivative manifest, E12 CCTV log, E13 laboratory transcript, E14 publication receipt/excerpt, E15 illustrated handling comparison, E16 correspondence ledger. A missing reverse from the publication proves the package needs correction; it does not establish deliberate concealment. Lucian remains the deliverer of EXT-02 pieces, Adrian deferred AR-01 latch repair, all four signatures remain genuine, and fire origin remains unresolved.

An optional Elias/Adrian scene becomes eligible after A14 and opening MA-22. It waits until no dialog/media interaction is active, can be deferred, reopened, or read, and never gates a required activity. Pending recordings are visibly labeled. The soundtrack pauses only for actual call/signal playback and resumes only if still enabled.

### Closing the file

A newly accepted A32 opens the ending once per completed run, followed by immediate access to the report. Restored completion never auto-opens it. The 14-second DOM/CSS scene separates the accusation from the genuine source signatures, shows the B17-R review/publication distinction and ends with «انكشفت الرواية… وبقي الأثر.». It adds no new evidence and does not establish fire origin or deliberate concealment. Presentation metadata is separate from scoring and survives only for its matching, valid completed run.

Skip goes directly to the static closing card; replay remains available from the completed activity, deductions and report. Reduced motion, quiet mode and Save-Data go directly to the card. The modal supports keyboard dismissal and focus return at 320px; playback controls remain below the 16:9 image. Timelines pause when hidden, and route changes/reset dispose playback. A future verified video starts muted and only explicitly enabled sound ducks the existing song; user pause and chosen volume remain authoritative. Missing or failed media cannot block the report. See `ENDING_PRODUCTION.md` for the optional actual-video brief, which remains pending separately from the existing laboratory manifest.

The local timer is elapsed active practice time. Ranked time is server wall-clock time and continues across navigation/offline periods. A ranked attempt cannot be created by uploading a practice save. The server checks answers and source availability, commits requests transactionally with idempotency, and publishes only an opted-in alias. Cloud saves use revision checks and retain both sides of a conflict. Default configuration keeps online controls unavailable until a real deployment exists.

## Acceptance criteria

- All static routes load directly, remain noindex, and contain no content iframe.
- At 320, 390, and 430 px and desktop width, content fits the viewport and media controls do not obscure images.
- All thirteen actions have keyboard/touch paths. A touch magnifier must not permanently trap page scrolling.
- All 32 activities can be completed through the UI; forward skips and early report access are rejected. The four original deductions retain their answers and support rules. Optional tools do not disclose unavailable sources.
- Song identity and position survive internal navigation. Film/Morse handoff, explicit pause, blocked playback, and failed media are handled.
- Reload restores preview work without mutating legacy storage. Reset, invalid saved data, and unavailable storage are covered.
- Initial transfer target is under 1.5 MB, including the short hero; secondary media and training load on demand. Measure transfer, not just directory size.
- Source, README, visual review screenshots, and test results accompany the prototype.
