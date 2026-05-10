#!/usr/bin/env bash
# scripts/check-env.sh — pre-flight wired into `predev` (npm convention).
#
# Validates, in order, that everything `npm run dev` needs is in place:
#   1. Docker daemon up.
#   2. npx is available so `@notionhq/notion-mcp-server` can be fetched
#      on demand. We don't pull the package here (slow) — we just prove
#      the resolver works.
#   3. apps/agent/.env exists and has GEMINI_API_KEYS or GEMINI_API_KEY,
#      plus NOTION_TOKEN and
#      NOTION_LEADS_DATABASE_ID set to non-stub values.
#   4. Notion is reachable AND the leads database is shared with the
#      integration. Defers to `apps/agent/src/notion_tools.py --check`, which
#      reports an actionable FAIL: with the share-gotcha fix on a 404.
#
# Collects every problem into a numbered list rather than bailing on the
# first failure, so participants can fix the whole batch in one pass.
# Exit 0 silently on success.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROBLEMS=()

# ---------- 1. Docker daemon -------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  PROBLEMS+=("Docker isn't installed. Install Docker Desktop and re-try.")
elif ! docker info >/dev/null 2>&1; then
  PROBLEMS+=("Docker isn't running. Start Docker Desktop and re-try.")
fi

# ---------- 2. npx (for the Notion MCP server) -------------------------------
if ! command -v npx >/dev/null 2>&1; then
  PROBLEMS+=("npx is not on PATH. Install Node.js 20+ (npm bundles npx).")
fi

# ---------- 3. agent/.env vars -----------------------------------------------
AGENT_ENV="$REPO_ROOT/apps/agent/.env"
if [[ ! -f "$AGENT_ENV" ]]; then
  PROBLEMS+=("apps/agent/.env is missing. Run: cp apps/agent/.env.example apps/agent/.env, then fill in the keys.")
else
  # Read VAR=VALUE lines. We tolerate values without quotes (the .env files
  # ship without quotes) and strip surrounding whitespace.
  read_var() {
    local key="$1"
    grep -E "^[[:space:]]*${key}=" "$AGENT_ENV" | tail -n1 | sed -E "s/^[[:space:]]*${key}=//; s/^[\"']//; s/[\"'][[:space:]]*$//; s/[[:space:]]+$//"
  }
  is_stub() {
    local v="$1"
    [[ -z "$v" ]] && return 0
    case "$v" in
      stub*|"<paste"*|"<set"*|"replace-with-"*) return 0 ;;
    esac
    return 1
  }
  gemini_keys="$(read_var "GEMINI_API_KEYS" || true)"
  gemini_key="$(read_var "GEMINI_API_KEY" || true)"
  google_key="$(read_var "GOOGLE_API_KEY" || true)"
  if is_stub "$gemini_keys" && is_stub "$gemini_key" && is_stub "$google_key"; then
    PROBLEMS+=("GEMINI_API_KEYS is unset (or a stub) in apps/agent/.env. Set it to a comma-separated primary,backup key list from https://aistudio.google.com -> Get API key.")
  fi

  # Notion checks only fire if you've opted into the leads/Notion flow
  # (NOTION_TOKEN set to a non-stub). Hearth devs can leave it unset — the
  # leads canvas is legacy starter scaffolding.
  notion_token="$(read_var "NOTION_TOKEN" || true)"
  if ! is_stub "$notion_token"; then
    notion_db="$(read_var "NOTION_LEADS_DATABASE_ID" || true)"
    if is_stub "$notion_db"; then
      PROBLEMS+=("NOTION_LEADS_DATABASE_ID is unset in apps/agent/.env (NOTION_TOKEN is set, so we assume you want the leads flow). Paste the database id from your Notion database URL, or clear NOTION_TOKEN to skip Notion checks.")
    fi
  fi
fi

# ---------- 4. Notion reachable + database shared (only if Notion in use) ---
# Live health check only when both Notion vars are populated. Hearth-only devs
# don't need Notion at all, so we skip silently.
if [[ ${#PROBLEMS[@]} -eq 0 && -f "$AGENT_ENV" ]]; then
  notion_token="$(read_var "NOTION_TOKEN" || true)"
  notion_db="$(read_var "NOTION_LEADS_DATABASE_ID" || true)"
  if ! is_stub "$notion_token" && ! is_stub "$notion_db"; then
    HEALTH_OUT="$(cd "$REPO_ROOT/apps/agent" && uv run python -m src.notion_tools --check 2>&1 || true)"
    if ! grep -q "^OK: " <<<"$HEALTH_OUT"; then
      PROBLEMS+=("Notion health check failed:
$HEALTH_OUT")
    fi
  fi
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
