"""LangGraph entry point for `langgraph dev --port 8133`.

Wires the **Hearth Mood Architect** agent:
- A switchable runtime (Gemini Flash-Lite + deepagents | Gemini Flash-Lite + react |
  Claude Sonnet 4.6 + react) selected by `AGENT_RUNTIME`.
- Hearth backend tools — `classify_mood_for_goal` + `regenerate_mood_profile`
  — exposed via `make_hearth_backend_tools()`. These mutate `state.profile`
  via Command(update=) so STATE_SNAPSHOT carries the new MoodProfile to the
  frontend without a separate setProfile call.
- TimingMiddleware + MoodStateMiddleware + CopilotKitMiddleware (see
  `src/runtime.py` for the chain).

Frontend tools (`updateLeverValue`, `addLever`, `swapScene`,
`regenerateMoodProfile`) are declared on the React side via
`useFrontendTool` in `apps/frontend/src/components/copilot/hearth-tools.tsx`.
The runtime forwards those declarations into the agent's tool list at run
time, so we deliberately do NOT include Python frontend stubs here —
adding them would cause Gemini to reject the request with "Duplicate
function declaration found: <name>".
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

from src.gemini_keys import get_gemini_api_keys, has_gemini_api_key
from src.hearth.backend_tools import make_hearth_backend_tools
from src.intelligence_cleanup import wipe_orphan_threads
from src.prompts import build_system_prompt
from src.runtime import build_graph


# Load .env early so GEMINI_API_KEYS / NOTION_TOKEN / ANTHROPIC_API_KEY are visible.
load_dotenv()


# `langgraph dev` uses an in-memory checkpoint store, so every agent boot
# starts with zero threads in LangGraph but the Intelligence Postgres
# still holds the chat history from the previous run. Without this
# cleanup, the next `getCheckpointByMessage` lookup throws "Message not
# found" and surfaces in the UI as an opaque rxjs stack trace.
# See `src/intelligence_cleanup.py` for the full rationale.
wipe_orphan_threads()


# Stub-key warnings for the active runtime live closer to the runtime selector.
# The Gemini runtimes still warn here so the message is loud at boot.
_AGENT_RUNTIME = os.getenv("AGENT_RUNTIME", "gemini-flash-react")

# deepagents `create_deep_agent` calls `apply_provider_profile(spec)` which
# expects a string model id, not a chat-model instance. We pass instances so
# that backup-key fallbacks (gemini_keys.build_gemini_chat_model) survive.
# When AGENT_RUNTIME=gemini-flash-deep and we have keys configured, swap to
# gemini-flash-react which accepts model instances. The behavior the user
# actually cares about (Hearth Mood Architect emitting MoodProfiles via
# tool calls) is identical between the two runtimes.
if _AGENT_RUNTIME == "gemini-flash-deep" and len(get_gemini_api_keys()) >= 1:
    print(
        "[runtime] AGENT_RUNTIME=gemini-flash-deep is incompatible with "
        "backup-key fallbacks; using gemini-flash-react instead. Set "
        "AGENT_RUNTIME=gemini-flash-react in .env to silence this notice.",
        flush=True,
    )
    _AGENT_RUNTIME = "gemini-flash-react"

print(f"[runtime] AGENT_RUNTIME={_AGENT_RUNTIME}", flush=True)

_gemini_keys = get_gemini_api_keys()
if _AGENT_RUNTIME.startswith("gemini-") and not _gemini_keys:
    print(
        "\n  GEMINI_API_KEYS / GEMINI_API_KEY is unset or a stub.\n"
        "   The agent will boot but chat will fail on the first turn.\n"
        "   Get a key at https://aistudio.google.com → Get API key,\n"
        "   then set GEMINI_API_KEYS in .env and apps/agent/.env.\n",
        flush=True,
    )
elif _AGENT_RUNTIME.startswith("gemini-"):
    print(
        f"[runtime] Gemini keyring loaded with {len(_gemini_keys)} key(s)",
        flush=True,
    )


# Hearth backend tools — classify_mood_for_goal + regenerate_mood_profile.
# These wrap architect.py's Gemini calls and emit Command(update={"profile": ...})
# so MoodStateMiddleware ships the new profile to the frontend via STATE_SNAPSHOT.
# Frontend tools (updateLeverValue, addLever, swapScene, regenerateMoodProfile)
# are forwarded automatically by CopilotKitMiddleware — see hearth-tools.tsx.
backend_tools = make_hearth_backend_tools()
print(
    f"[hearth] backend tools loaded: {[t.name for t in backend_tools]}",
    flush=True,
)


# build_system_prompt() takes a legacy integration_status arg from the
# lead-triage starter; the Hearth prompt ignores it.
SYSTEM_PROMPT = build_system_prompt("")


_use_noop = (
    _AGENT_RUNTIME.startswith("gemini-")
    and not has_gemini_api_key()
)
if _use_noop:
    print(
        "\n[runtime] Gemini API key missing or stub — using noop fallback graph.\n"
        "          Chat will reply with a setup pointer instead of hanging.\n",
        flush=True,
    )

# Frontend tools are NOT listed here — see module docstring.
graph = build_graph(
    "noop" if _use_noop else _AGENT_RUNTIME,
    tools=backend_tools,
    system_prompt=SYSTEM_PROMPT,
)


def main() -> None:
    """Entry point for `uv run dev` / `python -m agent`.

    `langgraph dev` is the canonical local-dev runner — this just exists to
    satisfy the `[project.scripts] dev = "agent:main"` entry point.
    """
    import subprocess

    subprocess.run(
        ["langgraph", "dev", "--port", "8133"],
        check=True,
    )


if __name__ == "__main__":
    main()
