# Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Boots infra, then UI + BFF + agent concurrently |
| `npm run dev:full` | Same as `dev` plus the MCP server |
| `npm run dev:infra` | Postgres + Redis + Intelligence composite |
| `npm run dev:infra:down` | Tear infra down |
| `npm run dev:ui` | Frontend only (Next.js, port 3010) |
| `npm run dev:bff` | CopilotKit runtime BFF only (Hono, port 4010) |
| `npm run dev:agent` | Agent only (`langgraph dev`, port 8133) |
| `npm run dev:mcp` | MCP server only (port 3011) |
| `npm run build` | Production build |
