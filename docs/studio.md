# Creative studio

Run `npm run dev` from the repository root and open `http://localhost:3000`. `npm run build` checks TypeScript and produces the production site in `dist`.

The Arabic/English studio retains its scene editor, storyboard, Pexafy library, API example, and `/raven/index.html` archive. Prompts, settings, saved scene drafts, and storyboard changes persist in this browser's local storage. A visible message reports unavailable local storage. Clearing browser data clears these drafts; the studio does not synchronize them with a server.

“Save scene draft” saves the prompt and settings. It does not call a video generation provider. Existing video links are reference clips; if playback fails, the poster remains visible. The API tab is an illustrative example, not a verified integration. Provider credentials belong on a backend.

For a trusted development preview hostname, use an explicit allowlist:

```bash
STUDIO_ALLOWED_HOSTS=preview.example.com npm run dev
```

The separate simulated dialogue preview still runs with `npm start` on port 10000. See [its README](../server/ai-dialogue/README.md).
