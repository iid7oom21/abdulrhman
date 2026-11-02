# Local security review — 2026-11-02

This is a local source review and regression check, **not a Codex Security scan**. The requested Codex Security plugin was unavailable in this session. Scope: the React studio, RAVEN dialogue preview server and client, Vite configuration, and installed npm dependencies. This is not an exhaustive penetration test.

## Confirmed findings and changes

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | `addMsg` interpolated player messages into `innerHTML`, including messages reloaded from history. An HTML event handler could execute in the dialogue origin. | Build the name element with `textContent` and append the message as a text node. Browser regression checks cover live display and history reload. |
| High | History ownership came from the caller's `owner` query or `ownerId` body field. Supplying another player's ID exposed their history or replayed requests. | Issue a server-signed, HttpOnly, SameSite=Strict session cookie. Ignore caller-supplied owner fields. Reject request lookups without the matching owner. HTTP tests cover query/body spoofing and forged cookies. |
| High | Unvalidated JSON types and unknown characters could throw inside the async HTTP handler; the request body had no size bound. | Validate fields and characters, cap request bodies at 16 KiB and messages at 4,000 characters, return explicit 400/413/415 errors, and catch unexpected handler failures. |
| Medium | Request fingerprints used the first 16 characters of base64-encoded JSON, which only represented the common object prefix. Different prompts could be treated as the same request. | Hash the complete request content with SHA-256. Test identical replay and changed-message/shared-facts conflicts. |
| Medium | Vite accepted every Host header (`allowedHosts: true`), disabling protection against DNS rebinding. | Restore the default host restriction. Optional preview hostnames must be listed explicitly through `STUDIO_ALLOWED_HOSTS`. |

## Verification

- `npm audit --json`: zero reported vulnerabilities in the installed dependency graph (160 total dependencies).
- `npm test --prefix server/ai-dialogue`: 13 tests passed, including malformed input, body limits, owner isolation, cookie forgery, and replay conflicts.
- `npm run build`: TypeScript and production build passed.
- Browser checks exercise literal rendering of an HTML injection payload and history restoration; the payload creates no image element and executes no script.

## Deployment limits

The dialogue service remains a simulation with in-memory histories and a per-process session signing key. Restarting the service resets session identity and history; this is not a durable account system. Existing histories identified by client-selected IDs are intentionally not migrated because those IDs cannot prove ownership. No external AI/video service is connected and no deployment was performed.

Use HTTPS for public deployment and set `COOKIE_SECURE=true` when TLS terminates at a reverse proxy. Configure proxy-level rate limiting and a retention policy before accepting sustained public traffic: the in-memory history map is not currently bounded. Browser-local studio drafts are retained only in the browser that created them and are not a server backup.
