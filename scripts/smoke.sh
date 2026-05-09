#!/usr/bin/env bash
# scripts/smoke.sh — "is my machine wrong, or is the code wrong?" diagnostic.
#
# Run after `npm run dev` is up. Probes each service and reports PASS/FAIL.
# Prints actionable hints, exits 0 on full pass, 1 otherwise.
#
# Usage:  npm run smoke

set -u  # don't -e — we want every check to run

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colors (no-op when stdout isn't a TTY).
if [[ -t 1 ]]; then
  G="\033[32m"; R="\033[31m"; Y="\033[33m"; D="\033[2m"; N="\033[0m"
else
  G=""; R=""; Y=""; D=""; N=""
fi

PASS=0
FAIL=0

pass() { printf "  ${G}PASS${N} %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "  ${R}FAIL${N} %s\n         ${D}%s${N}\n" "$1" "$2"; FAIL=$((FAIL+1)); }

# ---------- Required tools --------------------------------------------------
echo "Tools"
command -v docker >/dev/null && pass "docker on PATH"          || fail "docker missing"            "Install Docker Desktop."
command -v node   >/dev/null && pass "node on PATH"            || fail "node missing"              "nvm install 20 (matches .nvmrc)."
command -v uv     >/dev/null && pass "uv on PATH"              || fail "uv missing"                "curl -LsSf https://astral.sh/uv/install.sh | sh"
command -v python3 >/dev/null && pass "python3 on PATH"        || fail "python3 missing"           "Install Python 3.11+ (matches .python-version)."

# ---------- Env files -------------------------------------------------------
echo
echo "Env files"
[[ -f .env ]] && pass "/.env exists"                           || fail ".env missing"              "cp .env.example .env, then paste keys from team chat."
[[ -f apps/agent/.env ]] && pass "apps/agent/.env exists"      || fail "apps/agent/.env missing"   "cp .env apps/agent/.env  (langgraph reads its own copy)."

# ---------- Docker infra (host ports from .env, with starter defaults) ------
load_port() { grep -E "^${1}=" .env 2>/dev/null | tail -n1 | cut -d= -f2 | tr -d '"' | tr -d "'" ; }
PG_PORT=$(load_port POSTGRES_HOST_PORT);    PG_PORT=${PG_PORT:-5433}
RD_PORT=$(load_port REDIS_HOST_PORT);       RD_PORT=${RD_PORT:-6381}
INT_PORT=$(load_port APP_API_HOST_PORT);    INT_PORT=${INT_PORT:-4203}

echo
echo "Infra (Docker)"
nc -z localhost "$PG_PORT" 2>/dev/null  && pass "postgres :$PG_PORT"             || fail "postgres :$PG_PORT unreachable"  "npm run dev:infra (starts the compose stack)."
nc -z localhost "$RD_PORT" 2>/dev/null  && pass "redis :$RD_PORT"                || fail "redis :$RD_PORT unreachable"     "npm run dev:infra"
nc -z localhost "$INT_PORT" 2>/dev/null && pass "intelligence-api :$INT_PORT"    || fail "intelligence :$INT_PORT down"    "npm run dev:infra; check 'docker compose ps'."

# ---------- App services ----------------------------------------------------
echo
echo "App services"
nc -z localhost 3010 2>/dev/null && pass "frontend :3010"      || fail "frontend :3010 down"     "npm run dev (or npm run dev:ui)."
nc -z localhost 8133 2>/dev/null && pass "agent :8133"         || fail "agent :8133 down"        "npm run dev (or npm run dev:agent). Check apps/agent/.env has GEMINI_API_KEYS."

# ---------- Agent health probe ----------------------------------------------
# TODO(team): decide what counts as "agent works" for our team and fill this in.
# Trade-off:
#   - Cheap probe: HTTP GET on langgraph's /docs or /openapi.json — proves the
#     server is alive but not that the model can be reached.
#   - Real probe: invoke a tiny tool (e.g. classify_goal with a fixed input) —
#     catches dead Gemini keys and bad model config, but adds ~2s + a quota hit.
# Recommend the real probe for hackathon (so you find a dead key before demo time),
# the cheap probe for a tight CI loop. Implement below; should be 5-10 lines.
agent_health_probe() {
  echo "  ${Y}SKIP${N} agent health probe — not implemented (see TODO in scripts/smoke.sh)"
}

echo
echo "Agent health"
agent_health_probe

# ---------- Summary ---------------------------------------------------------
echo
if [[ $FAIL -eq 0 ]]; then
  printf "${G}All %d checks passed.${N}\n" "$PASS"
  exit 0
else
  printf "${R}%d failed${N}, %d passed.\n" "$FAIL" "$PASS"
  exit 1
fi
