# Customization Guide

## Add a new card type

1. **Extend the type union** in `src/lib/canvas/types.ts`:

   ```ts
   export type CardType = "project" | "entity" | "note" | "chart" | "yourNewCard";
   ```

2. **Define its data shape** in the same file (`YourNewCardData` interface).

3. **Render it** in `src/components/canvas/CardRenderer.tsx` — add a branch for the new `type`.

4. **Tell the agent about it** in `agent/src/prompts.py` — extend `FIELD_SCHEMA` inside `CANVAS_PROMPT`.

5. **Add a frontend tool** for at least one mutation. **Declare it on the React side only** — `useFrontendTool({ name, description, parameters: z.object({...}), handler })` in `src/app/page.tsx`. The runtime forwards it to the agent at run time. Don't add the same tool to `agent/main.py`'s `tools=` list — Gemini rejects duplicate declarations with `"Duplicate function declaration found"`. The Python stubs in `agent/src/canvas.py` are documentation only.

## Swap the integration MCP server

1. Find an MCP server for your new integration (the [MCP server registry](https://github.com/modelcontextprotocol/servers) has dozens — Linear, Slack, GitHub, Google Drive, etc.).
2. Edit `agent/src/notion_mcp.py` → replace the `mcpServers` config dict (`command`, `args`, `env`) with the new server's. Update the wrapper functions (`mcp_query_data_source`, etc.) to call the new server's tool names.
3. Edit `agent/src/notion_integration.py` → adjust the row-shaping logic if your new integration's response shape differs.
4. Edit `agent/src/prompts.py` → `INTEGRATION_PROMPT`. Replace the Notion lead-form workflow prose with whatever the new integration expects (e.g. "When the user asks to file a bug, call `linear_create_issue` with…").
5. Restart the agent. Done.

## Add an MCP App tool

Three flavors depending on scope:

- **One more tool on the existing server.** Edit `mcp/index.ts`, add another `server.tool({ ... }, async (input) => widget({ ... }))`. The runtime auto-discovers it on the next reload.
- **A second MCP server alongside the kit's.** Scaffold with `npx create-mcp-use-app@latest <name>` (the official Manufact CLI) and register it in `bff/src/server.ts` under `mcpApps.servers[]`. Useful when you want a clean separation between domains.
- **A remote MCP server.** Set `MCP_SERVER_URL` in `.env` to someone else's deploy (Excalidraw, etc.) — the runtime swaps without code changes.

## Use runtime context from the UI

If you need to feed UI state (selected card, current view) into the agent's prompt, use `useAgentContext({ description, value })` from `@copilotkit/react-core/v2` inside a client component. The provided value is JSON-serialized and threaded into the agent's context on every turn — composing with the static `SYSTEM_PROMPT` defined in `agent/src/prompts.py`.
