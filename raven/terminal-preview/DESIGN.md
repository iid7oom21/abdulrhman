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
| Final report | After the four original deductions, show the existing reasoning and limits; separate personal notes and allow printing. |
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

All new state uses the `raven-preview:v1` namespace. Legacy progress may be imported once into an absent preview state, but production keys are never overwritten. Reset creates fresh preview case state so old progress cannot reappear through re-import. Case reset clears its notes, board, timeline, hypotheses, and practice badges while preserving film progress and sound preferences. Storage denial must leave an in-memory session usable.

Each route mounts and disposes its own events/media. The single audio owner survives route replacement. The prototype needs no backend, user account, mailing provider, fabricated festival award, or unpublished release date.

## Acceptance criteria

- All static routes load directly, remain noindex, and contain no content iframe.
- At 320, 390, and 430 px and desktop width, content fits the viewport and media controls do not obscure images.
- All thirteen actions have keyboard/touch paths. A touch magnifier must not permanently trap page scrolling.
- The four deductions can be completed with existing answers and evidence rules. Optional tools do not disclose answers.
- Song identity and position survive internal navigation. Film/Morse handoff, explicit pause, blocked playback, and failed media are handled.
- Reload restores preview work without mutating legacy storage. Reset, invalid saved data, and unavailable storage are covered.
- Initial transfer target is under 1.5 MB, including the short hero; secondary media and training load on demand. Measure transfer, not just directory size.
- Source, README, visual review screenshots, and test results accompany the prototype.
