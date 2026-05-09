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

# apps/agent/.env (used by langgraph dev)
GEMINI_API_KEY=AIza...
```

Prefer a different model (OpenAI, Anthropic, Ollama)? See [model-switching.md](model-switching.md).

---

## Notion MCP setup (lead-form demo)

The kit calls Notion through the official [Notion MCP server](https://github.com/makenotion/notion-mcp-server) — a standalone process spawned on demand via `npx -y @notionhq/notion-mcp-server`. Auth is a single Notion integration token plus an explicit per-database share. No global install, no OAuth flow, no third-party broker.

The kit is wired against an "AI Workshop Provider Community" lead-form database. The fastest path is to duplicate the public sample into your own workspace; you can also re-import a CSV/ZIP if you'd rather start from a snapshot.

### 1. Get the database into your workspace

**Option A — duplicate the public sample (recommended).**
1. Open the public template: [AI Workshop Provider Community](https://assorted-stomach-b12.notion.site/a274791c4e1e826d882d01562af74de9?v=0e04791c4e1e83ca834988083174d19e&source=copy_link).
2. In the top-right of the page, click the **Duplicate** icon (two overlapping squares, next to the share icon and the `…` menu). Notion will prompt you to pick a destination workspace and copy the database — schema, views, and seed rows all come along.
3. Once Notion drops you into the duplicated copy, **bookmark its URL** — you'll need the database id from it in step 3.

**Option B — re-import the bundled snapshot.**
1. In Notion, **Settings → Workspace → Import → Notion (CSV/ZIP)** and upload [`data/notion-leads-sample/ai-workshop-provider-community.zip`](../data/notion-leads-sample/ai-workshop-provider-community.zip). A quick-look CSV lives next to it at [`ai-workshop-provider-community.csv`](../data/notion-leads-sample/ai-workshop-provider-community.csv).

### 2. Create an integration and share it with the database

1. Go to [notion.so/profile/integrations/internal](https://www.notion.so/profile/integrations/internal) → **New integration** → name it (e.g. "genai-starterkit") → copy the **Internal Integration Token** (starts with `ntn_…` or `secret_…`). Bookmark this page — it's also where you'll come back to rotate the token or audit which databases the integration can see.
2. Open the duplicated database in Notion. Click the `…` menu in the top-right → **Connections** (count badge will read `0`) → **Add connection** → pick the integration you just created. The panel will flip to **Active connections** with your integration listed.

   > Notion's permission model is per-database — a fresh integration token sees zero databases until it's been shared into them. **Forgetting this share step is the most common point of failure.** If `npm run dev` boots cleanly but `Import the leads` fails with "object not found", come back here.

> **Learn more:** Notion's [Getting started with the Notion API](https://developers.notion.com/guides/get-started/overview) covers integration types, the per-database share model, and the API surface the official MCP server wraps.

### 3. Paste the credentials into `.env`

Pull the database id from the URL of your duplicated copy: it's the 32-char hex string between the workspace slug and the `?v=` query (e.g. `a274791c4e1e826d882d01562af74de9`).

Paste both into `apps/agent/.env` (and `.env` at the repo root):

```bash
NOTION_TOKEN=<paste the Internal Integration Token>
NOTION_LEADS_DATABASE_ID=<paste the database id from its Notion URL>
```

### 4. Restart the agent

```bash
npm run dev
```

Then try: **"Import the workshop leads."**

To use a different MCP server (Linear, Slack, GitHub, …), edit `apps/agent/src/notion_mcp.py` — replace the `mcpServers` config dict and update `mcp_query_data_source` / friends to call the new server's tool names. Then edit `apps/agent/src/prompts.py` (`INTEGRATION_PROMPT`) so the agent knows the new vocabulary.

---

## Manual setup (alternative to the CLI)

If you can't or don't want to use `npx copilotkit@latest init`:

1. Get a license token: `npx copilotkit license -n hackathon-kit` — paste into `.env` as `COPILOTKIT_LICENSE_TOKEN`.
2. Bring up infra:
   ```bash
   docker compose up -d --wait
   ```
   This pulls `ghcr.io/copilotkit/intelligence/composite` and starts Postgres + Redis alongside.
3. Copy env templates: `cp .env.example .env` and `cp apps/agent/.env.example apps/agent/.env`. Paste your keys.
4. Install + run:
   ```bash
   npm install
   npm run dev
   ```

The intelligence env vars (`INTELLIGENCE_API_URL`, `INTELLIGENCE_GATEWAY_WS_URL`, `INTELLIGENCE_API_KEY`) match `deployment/docker-compose.yml`'s defaults — no manual editing needed for local dev.

---

## Removing Intelligence (Docker-free mode)

If you can't run Docker, strip Intelligence and use the kit as a plain CopilotKit + Deep Agents demo. Threads won't persist across reloads, but everything else works.

| Action | Path |
|---|---|
| Edit | `apps/bff/src/server.ts` — remove `intelligence`, `identifyUser`, `licenseToken` from the `CopilotRuntime` constructor (and the `CopilotKitIntelligence` import + instantiation) |
| Edit | `apps/frontend/src/app/leads/page.tsx` — remove `<ThreadsDrawer>` wrapper |
| Delete | `apps/frontend/src/components/threads-drawer/` |
| Delete | `deployment/docker-compose.yml`, `deployment/init-db/` |
| Edit | `.env.example` — remove `COPILOTKIT_LICENSE_TOKEN` and `INTELLIGENCE_*` |
