# Troubleshooting

`npm run dev` runs `scripts/check-env.sh` before anything boots — most of the problems below are caught there with the exact fix in the output. The table maps every known failure mode to its fix; entries below it are the older expanded explanations.

| Symptom | Cause | Fix |
|---|---|---|
| `npm run dev` aborts with "Docker isn't running" | Docker Desktop not started | Start Docker Desktop and re-run. The pre-flight retries automatically. |
| Pre-flight prints "GEMINI_API_KEY is unset (or a stub)" | Gemini key not pasted into `agent/.env` | Get one at https://aistudio.google.com → Get API key, paste into `agent/.env` (and `.env`). |
| Pre-flight prints "NOTION_TOKEN is unset" | Notion token not pasted | Create an integration at https://notion.so/my-integrations and paste the Internal Integration Token into `agent/.env`. |
| Chat hangs forever, never replies | `GEMINI_API_KEY` not set when you skipped the pre-flight (e.g. ran `npm run dev:agent` directly) | Set it in `agent/.env` and restart the agent. The agent now answers in <3s with a setup pointer when the key is missing instead of hanging. |
| Toast: "Run `npm run seed` to seed the default user" | Postgres `default` / `1_default` user not seeded | Run `npm run seed`. The BFF rewrites the upstream `threads_user_id_fkey` 500 into this hint automatically. |
| Notion health check returns "0 rows" or "shared with this integration" | Database not shared with your integration | Open the database in Notion → `...` menu → **Connections** → **+ Add connection** → pick your integration **directly** (not via parent-page inheritance — that's the most common gotcha). |
| `Could not find database with ID …` | Wrong `NOTION_LEADS_DATABASE_ID` *or* not shared | Both — verify by running `cd agent && uv run python -m src.notion_tools --check`. The output names which one is wrong. |
| `Failed to initialize thread` (raw error, no hint) | BFF couldn't reach Intelligence at all | `docker compose ps` should show `intelligence`, `postgres`, `redis` healthy; if not, `npm run dev:infra:down && npm run dev:infra`. |
| Empty canvas, no errors anywhere | Agent booted without the integration prompt | Restart the agent (`npm run dev:agent`). The boot log should print `[notion_health_check] db="…" rows=50 …`. |

<details>
<summary><strong>Threads don't persist across reloads</strong></summary>

Intelligence isn't running. Check:
- Docker is running.
- `docker compose ps` shows `intelligence`, `postgres`, `redis` healthy.
- `COPILOTKIT_LICENSE_TOKEN` is set in `.env`.
- The runtime route includes `intelligence: new CopilotKitIntelligence({...})`.

</details>

<details>
<summary><strong>Gemini quota exceeded</strong></summary>

Free tier is generous but not infinite. Either wait, switch to a paid Gemini key, or temporarily swap the model id in `agent/src/runtime.py` (`_gemini_llm`) to `gemini-3-flash` (frontier-class quality) or `gemini-3-pro-preview` (more reasoning, slower) — each tier has its own quota.

</details>

<details>
<summary><strong>Agent says "I'm having trouble connecting to my tools"</strong></summary>

1. Is the agent running? Check the `agent` log line in your terminal — it should print `Application startup complete` and bind to `:8133`.
2. Is `GEMINI_API_KEY` set in `agent/.env`?
3. Run `cd agent && uv run langgraph dev --port 8133` directly to see the actual error.

</details>

<details>
<summary><strong>Notion import returns 0 rows or "unauthorized"</strong></summary>

1. Verify `NOTION_TOKEN` is set in `agent/.env` and starts with `secret_` or `ntn_`. Get one at https://notion.so/my-integrations.
2. **Share the database with your integration.** This is the most common point of failure — Notion's per-database access model means a fresh integration token sees zero databases until they're explicitly shared with it. In the database in Notion: `...` menu → **Connections** → add your integration.
3. Verify `NOTION_LEADS_DATABASE_ID` matches the database (paste it from the Notion URL, hyphens optional).
4. From `agent/`, run `uv run python -c "from src.notion_integration import health_check; import json; print(json.dumps(health_check(), indent=2))"` to see the failure verbatim.

</details>

<details>
<summary><strong>Manufact tunnel won't bind</strong></summary>

The `--tunnel` flag needs network egress. If you're on a VPN or restrictive corporate network, deploy instead: `npm run -w mcp deploy`.

</details>

<details>
<summary><strong>Port already in use</strong></summary>

```bash
lsof -ti:3010 | xargs kill -9   # frontend (Next.js)
lsof -ti:4000 | xargs kill -9   # BFF (Hono runtime)
lsof -ti:8133 | xargs kill -9   # agent (langgraph dev)
lsof -ti:3011 | xargs kill -9   # mcp
lsof -ti:4203 | xargs kill -9   # intelligence app-api (default; APP_API_HOST_PORT in .env)
lsof -ti:4403 | xargs kill -9   # intelligence realtime gateway (REALTIME_GATEWAY_HOST_PORT)
```

</details>

<details>
<summary><strong>Intelligence container failed to start</strong></summary>

```bash
docker compose logs intelligence
```

Most common causes: license token missing/invalid, port collision on `:4203` / `:4403` / `:5433` / `:6381` (or whatever you set in `.env`), or Postgres failed to initialize. Try `npm run dev:infra:down` then `npm run dev:infra`.

</details>

<details>
<summary><strong>Python import errors after install</strong></summary>

```bash
cd agent
rm -rf .venv
uv venv
uv sync
```

</details>
