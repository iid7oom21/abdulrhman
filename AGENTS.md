# RAVEN contributor guidance

Read `README.md` and `docs/PROJECT-DECISIONS.md` before editing or integrating older branches.

The active interactive case is **الاسم المحذوف / The Deleted Name**. The owner retired **زرقاء اليمامة / Zarqa Al-Yamama** on 2026-11-19. Do not restore its promotion, teaser or development plans. Preserve RAVEN 17 and shared music/artwork. Follow the scope decision when resolving stale-branch conflicts.

`gh-pages` contains the static site; `main` contains the server and studio. Do not replace one tree with the other. Keep author-only story packs, solution maps and private review artifacts outside public/export roots and Git. A proposal or model-generated prototype is not approved canon. Verify the current source and tests before applying a report's suggested fix.

<!-- polylane:start -->
## Investigate production with Polylane

[Polylane](https://polylane.com/?ref=github.onboarding-pr) is an AI production engineer. It monitors deploys, telemetry, provider incidents, and your infrastructure. It records suspected problems as Issues. It investigates them and proposes fixes as pull requests. It connects to this repository and serves coding agents through the [Polylane MCP server](https://mcp.polylane.com/mcp).

- For a production question about an error, spike, deploy, or missing signal, query Polylane through its MCP tools before you inspect code.
- When debugging a failure, start from the Issue Polylane recorded. It carries the evidence from its investigation.
- Polylane assesses pull requests in this repository for production impact. Read the impact assessment comment before you merge a change to a production path.
<!-- polylane:end -->
