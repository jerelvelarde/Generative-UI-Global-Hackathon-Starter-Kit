# Generative UI Global Hackathon: Agentic Interfaces Starter Kit

![Hackathon Banner](public/banner.jpg)

A complete AI agent starter wired for a **Notion lead-capture / CRM-lite** usecase: durable conversation threads, an agent-driven canvas of lead cards, bidirectional sync with a Notion "Leads" database, and a deployable MCP App — all in one repo.

https://github.com/user-attachments/assets/6f44cf84-e485-4c26-8703-481e0c9c2c54

- **Persistent threads.** Every conversation is named, listed in the sidebar, and survives reloads, restarts, and resumes mid-run.
- **Agent-driven canvas.** Lead cards, follow-up notes, and pipeline charts the AI can create, edit, and organize while you watch.
- **Real integrations via MCP.** Notion Leads database sync out of the box; swap to any other MCP server with one config edit.
- **Deployable MCP server.** A third agent surface that runs in Claude or ChatGPT, deployable with one command.
- **Generative UI primed.** Stream Gemini-rendered components without re-plumbing.

---

## Stack

### CopilotKit

CopilotKit connects your app's logic, state, and user context to the AI agents that deliver the animated and interactive part of your app experience — across both embedded UIs and fully headless interfaces. The kit ships with **CopilotKit Intelligence** wired in, giving you durable conversation threads (Postgres-backed), a runtime that bridges your frontend to any LangGraph agent, and built-in support for generative UI and MCP App composition.

[More about CopilotKit ->](https://docs.copilotkit.ai)

### LangChain Deep Agents

LangChain Deep Agents is a Python framework that gives an LLM agent built-in planning, sub-agent dispatch, a virtual filesystem, and a TODO loop — the patterns popularized by Claude Code and Manus, packaged as a `create_deep_agent(...)` call on top of LangGraph. The kit uses Deep Agents as the brain behind the canvas: a single prompt like "import the workshop leads and draft outreach to the top 5" triggers a multi-step plan that the agent executes tool-by-tool while you watch the cards appear.

[More about Deep Agents ->](https://github.com/langchain-ai/deepagents)

### Gemini

Gemini 3.1 Flash-Lite is Google's high-volume workhorse in the Gemini 3 family — fast, cheap, and tool-calling-capable. The kit defaults to **`gemini-3.1-flash-lite`** for chat — pick up an API key from [Google AI Studio](https://aistudio.google.com), drop it into `.env`, and you're done. Need a more reasoning-heavy model? Swap to **Gemini 3 Pro Preview** or **Gemini 3 Flash** with a one-line edit in `agent/src/runtime.py` (`_gemini_llm`). Swapping to OpenAI, Anthropic, or any other LangChain-supported model is also a one-line edit (see [Switching to a different model](dev-docs/model-switching.md)).

[More about Gemini ->](https://ai.google.dev/gemini-api/docs)

### A2UI

[A2UI](https://a2ui.org/) is a protocol for agent-driven interfaces — it lets AI agents generate rich, interactive UI that renders natively across web, mobile, and desktop **without executing arbitrary code**. That sandboxed-by-default model pairs well with the kit's generative UI surface: Gemini emits A2UI components, the renderer paints them, and the agent never ships executable code to the client. Browse the [custom catalog](https://a2ui-composer.ag-ui.com/custom-catalog) for component examples.

[More about A2UI ->](https://github.com/google/A2UI)

### Notion MCP (via mcp-use)

The kit ships with a **Notion Leads database demo** wired through the official [Notion MCP server](https://github.com/makenotion/notion-mcp-server) (`@notionhq/notion-mcp-server`), called from Python via [mcp-use](https://manufact.com/mcp-use). MCP is the open protocol for connecting LLMs to tools — Anthropic publishes it, and Notion ships a first-party server. Swap to any other MCP server (Linear, Slack, GitHub, Google Drive, …) by changing one config dict in `agent/src/notion_mcp.py` and updating the prompt's `INTEGRATION_PROMPT`.

[More about MCP ->](https://modelcontextprotocol.io)

### Manufact / mcp-use

The kit's `mcp/` package is an MCP server built with [`mcp-use`](https://manufact.com/mcp-use), an open-source TypeScript framework for building MCP servers and MCP Apps. `npm run dev:mcp` gives you a full development environment with a local Inspector and support for hot reload for quick iteration. Easily deploy the server to Manufact Cloud with `npm run -w mcp deploy`.

[More about Manufact ->](https://manufact.com)

### Daytona

[Daytona](https://www.daytona.io/) is a secure and elastic infrastructure runtime for AI-generated code execution and agent workflows. Sandboxes spin up in under 90ms with full isolation — dedicated kernel, filesystem, network stack, and allocated vCPU/RAM/disk — and run any Python, TypeScript, or JavaScript code. Built on OCI/Docker compatibility with stateful environment snapshots, it's a natural fit when an agent in this kit needs to execute generated code or persist a workspace across sessions. Agents and developers interact with sandboxes programmatically through Daytona's SDKs, API, and CLI.

[More about Daytona ->](https://github.com/daytonaio/daytona)

---

## Run it locally

1. Run `npx @copilotkit/cli@latest init` and select **Intelligence** when prompted.
2. Drop a Gemini API key into **both** `.env` and `agent/.env`, plus a Notion integration token + database id. See [dev-docs/setup.md](dev-docs/setup.md) for keys + Notion sharing steps.
3. Run `npm install` then `npm run dev` (or `npm run dev:full` to include the MCP server).

> `npm run dev` runs a pre-flight check (`scripts/check-env.sh`) before booting anything — it'll fail loudly with a numbered list of any missing keys, an unreachable Notion database, or a Docker daemon that isn't running. Fix what it lists, re-run, and you're off. See [dev-docs/troubleshooting.md](dev-docs/troubleshooting.md) for fixes per failure mode.

Please give us feedback on your experience with it!

---

## Documentation

Deeper guides live in [`dev-docs/`](dev-docs/):

- [Setup](dev-docs/setup.md) · [Model switching](dev-docs/model-switching.md) · [MCP server](dev-docs/mcp-server.md)
- [Architecture](dev-docs/architecture.md) · [Customization](dev-docs/customization.md) · [Threads / Intelligence](dev-docs/threads.md)
- [Vibe coding](dev-docs/vibe-coding.md) · [Scripts](dev-docs/scripts.md) · [Demo prompts](dev-docs/demo-prompts.md) · [Troubleshooting](dev-docs/troubleshooting.md)

## License

MIT.

---

> Built for the Generative UI Global Hackathon: Agentic Interfaces.
