# Local RAVEN integration mount

The source branch integrates upstream main **c16e6a5** while retaining the local resume-summary endpoint and exact visual-asset allowlist. Frontend gh-pages **9a9bd1c**, including dd0aa5d comparison, is integrated separately. AGENTS.md and the current project scope decision were read before merging. No service settings or live deployment were changed.

The mount allows ten local visual CSS/JS files, twelve decorative WebP exports and the single investigation-lab/content.html page. It also retains the six reviewed atmosphere derivatives from upstream. There is no wildcard directory serving. The retired poster is not served; its original bytes are preserved separately outside Git/public roots.

GET /api/case/resume-summary authenticates the existing session and returns exactly schemaVersion, caseId, contentVersion, resumable, persistence and saveStatus. It creates or restores no session and reveals no scene, material, note or recovery credential.

Authenticated state responses also include clientSessionTag, using the existing domain-separated opaque session hash. This lets private reading tools scope their browser data in disk and memory modes as well as checkpoint mode. The tag cannot authenticate or restore a session. It is not added to persisted projections, the sealed checkpoint payload, exports or the six-field homepage summary. The storage schema and story engine are unchanged.

Relevant checks passed: scoped interrogation/provider/summary/service/mount tests122, existing local Render contracts30, new client-session-tag and storage regression35, and final shell/content mount13. Counts overlap and are not a unique grand total. Launcher and actual-files HTTP checks use local temporary sessions; fixture cases are explicitly labelled. Actual local browser journeys cover opening, explicit case start and investigation-room navigation. The model remains disabled. No production verification is implied.

Render's build pin remains the incoming9a9bd1c release. The new local room content is allowlisted without making it a required file in that older pinned export. Integrating these local changes for a future publication requires a separately coordinated frontend release; no publication is performed here.
