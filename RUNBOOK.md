# Hearth — Runbook

The single source of truth for **how to run this project on a teammate's machine**.
If you change how anything boots, update this file in the same commit.

---

## Required tools

Pinned in repo so everyone runs the same versions:

| Tool      | Version  | Pin file              | Install                                                              |
| --------- | -------- | --------------------- | -------------------------------------------------------------------- |
| Node      | 20.x     | `.nvmrc`              | `nvm install` (reads `.nvmrc`)                                       |
| npm       | 10+      | `package.json#engines`| Bundled with Node 20                                                 |
| Python    | 3.11.x   | `.python-version`     | `pyenv install 3.11` (reads `.python-version`) or system Python 3.11 |
| uv        | latest   | —                     | `curl -LsSf https://astral.sh/uv/install.sh \| sh`                   |
| Docker    | latest   | —                     | Docker Desktop (Mac/Win) or Docker Engine (Linux)                    |

If `npm install` complains about Node version, you skipped `nvm install`.

---

## Secrets

We share secrets via **team chat** for the hackathon. You need:

| Var                         | Where it goes                          | From            |
| --------------------------- | -------------------------------------- | --------------- |
| `GEMINI_API_KEYS`           | both `.env` and `apps/agent/.env`      | team chat       |
| `COPILOTKIT_LICENSE_TOKEN`  | both files                             | team chat       |
| `ANTHROPIC_API_KEY`         | only if `AGENT_RUNTIME=claude-...`     | team chat       |
| `NOTION_TOKEN` + `NOTION_LEADS_DATABASE_ID` | **leave blank for Hearth** | leads-only      |

Treat the chat-shared keys as sensitive — don't paste into PRs, screenshots, or
public Discord. Rotate after the hackathon.

---

## First-time setup

```bash
# 1. Pin tool versions (skip if you already have Node 20 + Python 3.11 active)
nvm install                        # reads .nvmrc
pyenv install -s "$(cat .python-version)" && pyenv local "$(cat .python-version)"

# 2. Env files (BOTH are required — agent reads its own copy)
cp .env.example .env
cp .env apps/agent/.env

# 3. Paste secrets from team chat into BOTH files:
#    GEMINI_API_KEYS=...    COPILOTKIT_LICENSE_TOKEN=...

# 4. Install everything (Node workspaces + uv sync for the agent)
npm install
```

---

## Run

```bash
npm run dev          # boots Docker infra, then UI + BFF + agent
# or
npm run dev:full     # adds the optional MCP server
# or
npm run dev:lowmem   # polling watchers + webpack UI; for Linux boxes hitting
                     # the inotify limit (no sudo). See "Common gotchas".
```

Open **http://localhost:3010**. Stop with `ctrl+C`, then:

```bash
npm run dev:infra:down   # tear down Postgres / Redis / Intelligence containers
```

Ports in use: `3010` UI · `8133` agent · `5433` postgres · `6381` redis · `4203` intelligence-api · `4403` realtime-gateway · `3011` MCP (optional). Override host ports in `.env` if any clash.

---

## Smoke test

Run **after** `npm run dev` is up. Diagnoses "is my machine wrong, or is the code wrong?" in 30 seconds.

```bash
npm run smoke
```

Reports PASS/FAIL per service with actionable hints. If it's all green, your environment matches everyone else's. If a check fails, the hint tells you what to do.

> **Note:** the agent health probe is intentionally unimplemented — see the TODO in `scripts/smoke.sh`. Pick the cheap or real probe based on your team's tolerance for false negatives.

---

## Common gotchas

| Symptom                                                                  | Cause                                          | Fix                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev` says `concurrently: not found` (exit 127)                  | Root `node_modules` never installed            | `npm install` in repo root (postinstall also `uv sync`s the agent) |
| Intelligence container restart-loops with `database "intelligence_app" does not exist` | Stale Postgres volume from a prior run skipped initdb scripts | `docker compose --project-directory . -f deployment/docker-compose.yml down -v` then `npm run dev:infra`. Volume wipe is project-scoped, doesn't touch other Docker projects. |
| Linux: BFF crashes with `ENOSPC: System limit for number of file watchers reached` | inotify watch limit too low (default 65K)     | If you have sudo: `sudo sysctl -w fs.inotify.max_user_watches=524288 fs.inotify.max_user_instances=512`. If not: use `npm run dev:lowmem` (polling + webpack, no inotify) |
| Linux: Turbopack panics with `OS file watch limit reached`               | Turbopack uses native inotify; ignores polling env vars | Same as above — sudo bump, or run `npm run dev:lowmem` which switches the UI to webpack mode |
| Active Node version doesn't match `.nvmrc`                               | Forgot to run `nvm use`                        | `nvm use` in repo root (or `nvm install 20 && nvm use 20`)        |
| Chat fails with vague auth error                                         | `GEMINI_API_KEYS` is still the stub value      | Paste real key from team chat into **both** `.env` files         |
| Agent boots but tools never respond                                      | `apps/agent/.env` not copied                   | `cp .env apps/agent/.env` and restart `npm run dev`              |
| `predev` complains about Notion                                          | `NOTION_TOKEN` is set to a real value          | Either fill in `NOTION_LEADS_DATABASE_ID` or **clear** `NOTION_TOKEN` (we're on Hearth, leave blank) |
| Port 5433 / 6381 / 4203 / 4403 already bound                             | Another local stack running                    | Edit `*_HOST_PORT` in `.env` to a free port                       |
| `npm run dev` hangs at "waiting for healthy"                             | Docker Desktop not running                     | Start Docker, retry                                              |
| Frontend reload but agent state doesn't update                           | Agent crashed (check `agent` color in console) | Look at the green-tagged log; usually a Python traceback         |
| "Run connection credentials not available" in chat                       | `COPILOTKIT_LICENSE_TOKEN` missing or stale    | Paste from team chat                                             |

---

## Branch hygiene

- One feature branch per person, named `<initials>/hearth-<area>` (e.g. `pm/hearth-wiring`, `lh/hearth-lever-card`).
- Merge to `main` end-of-each-hour, not end-of-day. Hackathon merge conflicts at hour 5 are how teams lose.
- Don't rebase someone else's WIP branch without telling them.

---

## When to update this file

- You change a port, env var, or required tool → update RUNBOOK in the same commit.
- A teammate hits a new gotcha → add a row to "Common gotchas".
- A new external service appears (e.g. Lyria credentials) → add it to "Secrets".
