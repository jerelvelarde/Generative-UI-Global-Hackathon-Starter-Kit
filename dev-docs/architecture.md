# Architecture

```mermaid
graph TB
    subgraph Browser
        UI["Canvas + Chat<br/>Next.js + React 19"]
        Drawer["Threads Drawer<br/>useThreads"]
    end

    subgraph Frontend["Next.js :3010"]
        Next["App Router<br/>proxies /api/copilotkit to BFF"]
    end

    subgraph BFFLayer["BFF :4000 — Hono"]
        Runtime["CopilotRuntime v2<br/>+ Intelligence<br/>+ LangGraphAgent<br/>+ mcpApps"]
    end

    subgraph LocalServices["Local services"]
        Agent["Deep Agent<br/>langgraph dev :8133<br/>Gemini Flash-Lite"]
        MCP["Manufact MCP :3011<br/>mcp-use"]
        NotionMCP["Notion MCP server<br/>npx notion-mcp-server"]
        Intel["Intelligence composite<br/>:4203 / :4403"]
        DB[("Postgres :5433")]
        Cache[("Redis :6381")]
    end

    subgraph External
        Notion["Notion Leads DB"]
        Gemini["Gemini API"]
    end

    UI <--> Next
    Drawer <--> Next
    Next <--> Runtime
    Runtime <--> Agent
    Runtime <--> MCP
    Runtime <--> Intel
    Intel --> DB
    Intel --> Cache
    Agent --> Gemini
    Agent --> NotionMCP
    NotionMCP --> Notion
```

> Default Intelligence/Postgres/Redis ports (`4201` / `4401` / `5432` / `6379`) are remapped via `.env` (`APP_API_HOST_PORT`, `REALTIME_GATEWAY_HOST_PORT`, `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`) so the kit boots cleanly on machines that already run another Intelligence stack. Override them in `.env` to use the originals.

```mermaid
sequenceDiagram
    participant User
    participant UI as Canvas + Chat
    participant Runtime
    participant Agent as Deep Agent
    participant Tools as Notion MCP / Manufact MCP

    User->>UI: Create three projects
    UI->>Runtime: chat message + threadId
    Runtime->>Agent: stream events (AG-UI)
    Agent->>Agent: plan (deepagents)
    Agent->>Tools: invoke tools
    Tools-->>Agent: tool results
    Agent->>Runtime: state updates
    Runtime->>UI: state snapshot
    UI->>User: cards render
    Note over Runtime: Intelligence persists thread
```

## Why a separate BFF?

The CopilotKit runtime (`@copilotkit/runtime/v2`) bundles express transitively, which Next.js can't tree-shake cleanly inside an App Router API route (the dynamic `require(mod)` in express's view engine breaks turbopack bundling). The kit instead runs the runtime as a Hono BFF on port 4000, and Next.js rewrites proxy `/api/copilotkit/*` to `http://localhost:4000` so frontend code stays on relative URLs and there's no CORS to manage.
