# Setup

Detailed setup for the kit — prerequisites, API keys, Notion configuration, and a long-form walkthrough of the run-locally steps.

## Prerequisites

- Node.js 20+
- Python 3.10+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python deps
- Docker (required for Intelligence — see [Removing Intelligence](#removing-intelligence-docker-free-mode) for the no-Docker path)
- A package manager: `pnpm` (recommended), `npm`, `yarn`, or `bun`
- API keys: Gemini (required), Notion integration token (required for the lead-form demo), CopilotKit license (issued by `npx copilotkit@latest license`)

> Lock files are gitignored so you can use any package manager. Generate one locally with your tool of choice.

---

## Get a CopilotKit Intelligence license (required)

Intelligence persists threads, runs the agent runtime, and gates the kit's hosted features. You need a license token before `npm run dev` will boot.

**Path A — CLI (recommended).**

```bash
npx copilotkit@latest license
```

Follow the prompt; the CLI prints a token. Paste it into `.env` at the repo root:

```bash
COPILOTKIT_LICENSE_TOKEN=ck_...
```

**Path B — dashboard.** If you can't run `npx` (corp network, sandboxed shell, etc.), sign in at [dashboard.operations.copilotkit.ai/sign-in](https://dashboard.operations.copilotkit.ai/sign-in), issue a token from the UI, and paste it into `.env` as above.

> Threads silently fail to persist without `COPILOTKIT_LICENSE_TOKEN`. The pre-flight check (`scripts/check-env.sh`) will flag a missing token before `npm run dev` boots.

---

## Get a Gemini API key (required)

This kit defaults to **Gemini 3 Flash Preview**. You need a Gemini API key for chat to work.

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google Account.
2. In the left sidebar, click **Get API key**.
3. Click **Create API key** — choose **Create API key in new project** or **in existing project**.
4. Copy the key (starts with `AIza`). You can retrieve it later from the same dashboard.

Full docs: https://ai.google.dev/gemini-api/docs/api-key

Then drop it into both env files. Prefer `GEMINI_API_KEYS` even if you only
have one key; add a second key after a comma for automatic failover:

```bash
# .env (root, used by the BFF + Next.js)
GEMINI_API_KEYS=AIza-primary...,AIza-backup...

# apps/agent/.env (used by langgraph dev)
GEMINI_API_KEYS=AIza-primary...,AIza-backup...
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

## Notes on the run-locally flow

A few things the [Run it locally](../README.md#run-it-locally) quickstart elides:

- **Docker is implicit.** `npm run dev` calls `npm run dev:infra` first, which runs `docker compose up -d --wait` against `deployment/docker-compose.yml`. That pulls `ghcr.io/copilotkit/intelligence/composite` and brings up Postgres + Redis alongside. If you'd rather bring infra up yourself, run `npm run dev:infra` once and then `npm run dev:ui` / `dev:bff` / `dev:agent` separately.
- **Intelligence env vars match the compose defaults.** `INTELLIGENCE_API_URL`, `INTELLIGENCE_GATEWAY_WS_URL`, and `INTELLIGENCE_API_KEY` in `.env.example` line up with `deployment/docker-compose.yml` — no manual editing needed for local dev.
- **License vs Gemini.** Both are required. The license is a one-time fetch (`npx copilotkit@latest license`). The Gemini keyring has to land in **both** `.env` (BFF + Next.js) and `apps/agent/.env` (agent's own dotenv).

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
