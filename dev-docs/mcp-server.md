# Manufact / mcp-use MCP server

The starter ships with a [mcp-use](https://manufact.com/mcp-use) MCP server in `mcp/`. Run it alongside the rest of the stack:

## Run it locally

```bash
npm run dev:full
```

This adds the MCP leg on `:3011`. Open `http://localhost:3011/inspector` to test your tools and widgets interactively with the built-in Inspector.

## Test it in Claude / ChatGPT (no deploy)

Start the dev server with a built-in tunnel to get a public HTTPS URL instantly — no deployment needed:

```bash
npm run -w mcp dev -- --tunnel
```

This opens a public HTTPS URL like `https://<subdomain>.local.mcp-use.run/mcp`. Add it as a remote MCP server:

- **Claude:** Settings → Integrations → Add integration → paste URL
- **ChatGPT:** Settings → Connectors → Add MCP server → paste URL

Smoke-test prompts (sample data is baked into each widget — no setup needed):
- "Show me the workshop lead list." → `show-lead-list`
- "Show the workshop demand breakdown." → `show-lead-demand`
- "Show me the lead pipeline." → `show-lead-pipeline`

## Deploy to Manufact Cloud

```bash
# Login to Manufact Cloud
npx @mcp-use/cli login

# Deploy
npm run -w mcp deploy
```

Live at `https://<your-slug>.run.mcp-use.com/mcp` and managed from [manufact.com/cloud](https://manufact.com/cloud).

Once deployed, point the runtime at it by setting `MCP_SERVER_URL` in `.env`.

## Want to start with a fresh server?

The kit's `mcp/` is hand-authored to fit the workspace (port `3011`, workspace-aware scripts, kit-specific demo widget). If you'd rather scaffold a brand-new MCP server from scratch use the official `create-mcp-use-app` CLI:

```bash
npx create-mcp-use-app@latest my-mcp-server
cd my-mcp-server && npm install && npm run dev
```

See the [create-mcp-use-app docs](https://manufact.com/docs/typescript/getting-started/quickstart) for full options.
