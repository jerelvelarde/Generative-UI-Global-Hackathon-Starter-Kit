#!/usr/bin/env bash
# scripts/check-env.sh - pre-flight wired into `predev` (npm convention).
#
# Validates, in order, that everything `npm run dev` needs is in place:
#   1. Docker daemon up.
#   2. npx is available so `@notionhq/notion-mcp-server` can be fetched
#      on demand. We don't pull the package here (slow) - we just prove
#      the resolver works.
#   3. Either root `.env` or `apps/agent/.env` provides GEMINI_API_KEY.
#   4. Root `.env` provides COPILOTKIT_LICENSE_TOKEN for Intelligence.
#   5. Optional: when NOTION_TOKEN + NOTION_LEADS_DATABASE_ID are present,
#      Notion is validated via `apps/agent/src/notion_tools.py --check`.
#
# Collects every problem into a numbered list rather than bailing on the
# first failure, so participants can fix the whole batch in one pass.
# Exit 0 silently on success.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROBLEMS=()
WARNINGS=()

# If set to 1, missing Notion credentials becomes a hard failure.
# Default 0 keeps local-store workflows unblocked.
STRICT_NOTION_ENV="${STRICT_NOTION_ENV:-0}"

resolve_docker_cmd() {
  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return 0
  fi
  if command -v docker.exe >/dev/null 2>&1; then
    command -v docker.exe
    return 0
  fi
  local win_docker="/c/Program Files/Docker/Docker/resources/bin/docker.exe"
  if [[ -x "$win_docker" ]]; then
    echo "$win_docker"
    return 0
  fi
  return 1
}

# ---------- 1. Docker daemon -------------------------------------------------
DOCKER_CMD="$(resolve_docker_cmd || true)"
if [[ -z "$DOCKER_CMD" ]]; then
  PROBLEMS+=("Docker isn't installed. Install Docker Desktop and re-try.")
elif ! "$DOCKER_CMD" info >/dev/null 2>&1; then
  PROBLEMS+=("Docker isn't running. Start Docker Desktop and re-try.")
fi

# ---------- 2. npx (for the Notion MCP server) -------------------------------
if ! command -v npx >/dev/null 2>&1; then
  PROBLEMS+=("npx is not on PATH. Install Node.js 20+ (npm bundles npx).")
fi

# ---------- 3. env vars (root .env + optional agent override) ----------------
ROOT_ENV="$REPO_ROOT/.env"
AGENT_ENV="$REPO_ROOT/apps/agent/.env"
notion_creds_present=0

if [[ ! -f "$ROOT_ENV" && ! -f "$AGENT_ENV" ]]; then
  PROBLEMS+=("No env file found. Create .env at repo root (preferred) or apps/agent/.env.")
else
  read_var_from_file() {
    local key="$1"
    local file="$2"
    if [[ ! -f "$file" ]]; then
      return 0
    fi
    grep -E "^[[:space:]]*${key}=" "$file" | tail -n1 | sed -E "s/^[[:space:]]*${key}=//; s/^[\"']//; s/[\"'][[:space:]]*$//; s/[[:space:]]+$//"
  }
  read_var() {
    local key="$1"
    local agent_val root_val
    agent_val="$(read_var_from_file "$key" "$AGENT_ENV" || true)"
    if [[ -n "$agent_val" ]]; then
      echo "$agent_val"
      return 0
    fi
    root_val="$(read_var_from_file "$key" "$ROOT_ENV" || true)"
    echo "$root_val"
  }
  is_stub() {
    local v="$1"
    [[ -z "$v" ]] && return 0
    case "$v" in
      stub*|"<paste"*|"<set"*|"replace-with-"*) return 0 ;;
    esac
    return 1
  }

  GEMINI_VAL="$(read_var GEMINI_API_KEY || true)"
  COPILOTKIT_LICENSE_VAL="$(read_var COPILOTKIT_LICENSE_TOKEN || true)"
  NOTION_TOKEN_VAL="$(read_var NOTION_TOKEN || true)"
  NOTION_DB_VAL="$(read_var NOTION_LEADS_DATABASE_ID || true)"

  if is_stub "$GEMINI_VAL"; then
    PROBLEMS+=("GEMINI_API_KEY is unset (or a stub) in .env (or apps/agent/.env override). Get a key at https://aistudio.google.com -> Get API key.")
  fi

  if is_stub "$COPILOTKIT_LICENSE_VAL"; then
    PROBLEMS+=("COPILOTKIT_LICENSE_TOKEN is unset in .env. Run `npx copilotkit@latest license` and paste the token into .env.")
  fi

  if ! is_stub "$NOTION_TOKEN_VAL" && ! is_stub "$NOTION_DB_VAL"; then
    notion_creds_present=1
  else
    if [[ "$STRICT_NOTION_ENV" == "1" ]]; then
      if is_stub "$NOTION_TOKEN_VAL"; then
        PROBLEMS+=("NOTION_TOKEN is unset (or a stub) in .env (or apps/agent/.env override). Get a token at https://notion.so/my-integrations -> New integration -> Internal Integration Token.")
      fi
      if is_stub "$NOTION_DB_VAL"; then
        PROBLEMS+=("NOTION_LEADS_DATABASE_ID is unset in .env (or apps/agent/.env override). Paste the database id from your Notion database URL.")
      fi
    else
      WARNINGS+=("Notion credentials are missing; running in local-store mode (set STRICT_NOTION_ENV=1 to require Notion).")
    fi
  fi
fi

# ---------- 4. Notion reachable + database shared ---------------------------
# Only run the live health check when Notion credentials are present.
if [[ ${#PROBLEMS[@]} -eq 0 && "$notion_creds_present" == "1" ]]; then
  HEALTH_OUT="$(cd "$REPO_ROOT/apps/agent" && uv run python -m src.notion_tools --check 2>&1 || true)"
  if ! grep -q "^OK: " <<<"$HEALTH_OUT"; then
    PROBLEMS+=("Notion health check failed:
$HEALTH_OUT")
  fi
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo ""
  for w in "${WARNINGS[@]}"; do
    echo "Warning: $w"
  done
fi

# ---------- Report -----------------------------------------------------------
if [[ ${#PROBLEMS[@]} -gt 0 ]]; then
  echo ""
  echo "Pre-flight check found ${#PROBLEMS[@]} problem(s):"
  echo ""
  i=1
  for p in "${PROBLEMS[@]}"; do
    # Indent multi-line problems so they read as one item.
    first_line="${p%%$'\n'*}"
    rest="${p#*$'\n'}"
    echo "  $i. $first_line"
    if [[ "$rest" != "$p" ]]; then
      while IFS= read -r line; do
        echo "     $line"
      done <<<"$rest"
    fi
    i=$((i+1))
  done
  echo ""
  echo "Fix these and re-run \`npm run dev\`."
  exit 1
fi

exit 0
