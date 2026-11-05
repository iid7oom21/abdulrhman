# RAVEN — supplied chat layout

The owner supplied this standalone HTML on 2026-11-04 and requested a GitHub upload. It is a separate review artifact; no official page, RAVEN image, existing story, or music player is replaced.

The supplied client-side credential was **not saved or committed**. The owner should revoke it at the provider. `DIALOGUE_ENDPOINT` remains `null`, so opening or submitting this page sends no provider request. There is no new backend or paid integration. Do not put a replacement credential in browser code.

The Arabic layout and greeting are retained, with limited changes for narrow screens and keyboard focus. Dynamic messages use `textContent`. The dormant response adapter reads `choices[0].message.content`, checks HTTP status and nonempty text, removes the loading element once, and keeps an unresolved request identifier instead of automatically retrying. The same-origin endpoint is deliberately unconfigured; its `{requestId, message}` request / OpenAI-shaped response is an integration sketch, **not an implemented contract for the repository server**. Pending/error recovery must be implemented against the chosen backend before enabling it. Conversations and request IDs here live only in the open page.

This generic investigator is not a recovered character or dialogue from «الاسم المحذوف». No recovered story or generated character portraits came with this pasted HTML.

Preview from the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/review/grok-chat/`. No build is needed. Browser verification and its scope are in `TEST-REPORT.md`.
