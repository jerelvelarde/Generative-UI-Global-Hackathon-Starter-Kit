# Switching to a different model

This kit ships **Gemini 3.1 Flash-Lite + deepagents** as the default. Two pre-wired Gemini runtimes are selectable via the `AGENT_RUNTIME` env var — no code edit needed:

| `AGENT_RUNTIME`        | Model                   | Planner                          |
|------------------------|-------------------------|----------------------------------|
| `gemini-flash-deep`    | `gemini-3.1-flash-lite` | `deepagents`                     |
| `gemini-flash-react`   | `gemini-3.1-flash-lite` | `langchain.create_agent` (react) |

Set in **both** `.env` and `agent/.env` (the agent reads its own copy):

```bash
AGENT_RUNTIME=gemini-flash-deep
```

A third runtime (`claude-sonnet-4-6-react`) is also wired in [`agent/src/runtime.py`](../agent/src/runtime.py) (`_build_claude_react`) if you'd rather run Claude — set `ANTHROPIC_API_KEY` in `agent/.env` and flip `AGENT_RUNTIME` to it. Use it as a template for any other LangChain provider.

Restart the agent (`npm run dev:agent`) and you should see `[runtime] AGENT_RUNTIME=...` in the agent log.

Want a different Gemini tier (`gemini-3-pro-preview`, `gemini-3-flash`) or a different provider entirely (OpenAI, etc.)? Edit `agent/src/runtime.py` — `_gemini_llm()` is the single place the model id lives, and `_build_*` factories show the LangChain provider import pattern to copy for a new provider. Re-run `cd agent && uv sync` if you add a new LangChain integration package.
