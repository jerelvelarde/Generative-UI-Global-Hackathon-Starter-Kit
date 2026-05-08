# Setup

Detailed setup for the kit — prerequisites, API keys, Notion configuration, and a manual setup path if you can't use the CopilotKit CLI.

## Prerequisites

- Node.js 20+
- Python 3.10+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python deps
- Docker (required for Intelligence — see [Removing Intelligence](#removing-intelligence-docker-free-mode) for the no-Docker path)
- A package manager: `pnpm` (recommended), `npm`, `yarn`, or `bun`
- API keys: Gemini (required), Notion integration token (required for the lead-form demo), CopilotKit license (issued by the CLI or `npm run license`)

> Lock files are gitignored so you can use any package manager. Generate one locally with your tool of choice.

---

## Get a Gemini API key (required)

This kit defaults to **Gemini 3.1 Flash-Lite**. You need a Gemini API key for chat to work.

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google Account.
2. In the left sidebar, click **Get API key**.
3. Click **Create API key** — choose **Create API key in new project** or **in existing project**.
4. Copy the key (starts with `AIza`). You can retrieve it later from the same dashboard.

Full docs: https://ai.google.dev/gemini-api/docs/api-key

Then drop it into both env files:

```bash
# .env (root, used by the BFF + Next.js)
GEMINI_API_KEY=AIza...

# agent/.env (used by langgraph dev)
GEMINI_API_KEY=AIza...
```

Prefer a different model (OpenAI, Anthropic, Ollama)? See [model-switching.md](model-switching.md).

---

## Notion MCP setup (lead-form demo)

The kit calls Notion through the official [Notion MCP server](https://github.com/makenotion/notion-mcp-server) — a standalone process spawned on demand via `npx -y @notionhq/notion-mcp-server`. Auth is a single Notion integration token plus an explicit per-database share. No global install, no OAuth flow, no third-party broker.

> **Sample database.** The kit is wired against an "AI Workshop Provider Community" lead-form database. Schema and seed rows live in two places — pick whichever's easier for you:
>
> - **Public reference (read-only):** [view in Notion](https://www.notion.so/a274791c4e1e826d882d01562af74de9?v=0e04791c4e1e83ca834988083174d19e&source=copy_link) — duplicate it into your workspace to get an editable copy.
> - **Re-importable export in this repo:** [`data/notion-leads-sample/ai-workshop-provider-community.zip`](../data/notion-leads-sample/ai-workshop-provider-community.zip) — in Notion, **Settings → Workspace → Import → Notion (CSV/ZIP)** and upload this file. Quick-look CSV alongside it: [`ai-workshop-provider-community.csv`](../data/notion-leads-sample/ai-workshop-provider-community.csv).

1. Create a Notion integration: go to https://notion.so/my-integrations → **New integration** → name it (e.g. "Hackathon kit") → copy the **Internal Integration Token**.
2. Open the Notion database you want to read from — either the sample above (duplicated into your workspace) or your own database with the same shape.
3. **Share the database with your integration**: open the database in Notion → click the `...` menu (top-right) → **Connections** → add the integration you just created. *Notion's per-database access model means a fresh token sees zero databases until it's been shared into them — this is the most common point of failure.*
4. Paste both into `agent/.env` (and `.env`):

   ```bash
   NOTION_TOKEN=<paste the Internal Integration Token>
   NOTION_LEADS_DATABASE_ID=<paste the database id from its Notion URL>
   ```

5. Restart the agent. Try: **"Import the workshop leads."**

To use a different MCP server (Linear, Slack, GitHub, …), edit `agent/src/notion_mcp.py` — replace the `mcpServers` config dict and update `mcp_query_data_source` / friends to call the new server's tool names. Then edit `agent/src/prompts.py` (`INTEGRATION_PROMPT`) so the agent knows the new vocabulary.

---

## Manual setup (alternative to the CLI)

If you can't or don't want to use `npx @copilotkit/cli@latest init`:

1. Get a license token: `npx copilotkit license -n hackathon-kit` — paste into `.env` as `COPILOTKIT_LICENSE_TOKEN`.
2. Bring up infra:
   ```bash
   docker compose up -d --wait
   ```
   This pulls `ghcr.io/copilotkit/intelligence/composite` and starts Postgres + Redis alongside.
3. Copy env templates: `cp .env.example .env` and `cp agent/.env.example agent/.env`. Paste your keys.
4. Install + run:
   ```bash
   npm install
   npm run dev
   ```

The intelligence env vars (`INTELLIGENCE_API_URL`, `INTELLIGENCE_GATEWAY_WS_URL`, `INTELLIGENCE_API_KEY`) match `docker-compose.yml`'s defaults — no manual editing needed for local dev.

---

## Removing Intelligence (Docker-free mode)

If you can't run Docker, strip Intelligence and use the kit as a plain CopilotKit + Deep Agents demo. Threads won't persist across reloads, but everything else works.

| Action | Path |
|---|---|
| Edit | `bff/src/server.ts` — remove `intelligence`, `identifyUser`, `licenseToken` from the `CopilotRuntime` constructor (and the `CopilotKitIntelligence` import + instantiation) |
| Edit | `src/app/page.tsx` — remove `<ThreadsDrawer>` wrapper |
| Delete | `src/components/threads-drawer/` |
| Delete | `docker-compose.yml`, `docker/init-db/` |
| Edit | `.env.example` — remove `COPILOTKIT_LICENSE_TOKEN` and `INTELLIGENCE_*` |
