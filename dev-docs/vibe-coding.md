# Vibe coding

The kit ships with skills pre-installed for Cursor, Claude Code, and any agent reading `.agent/`. Open the project in your coding tool and the skills are picked up automatically — no extra setup. They teach the agent CopilotKit's v2 API surface, MCP App authoring patterns, and the kit's own conventions.

```
.
├── .agent/skills/      ← agent-tool-agnostic (read by any agent following the AGENTS.md convention)
├── .claude/skills/     ← Claude Code
└── .cursor/skills/     ← Cursor
```

Each directory contains the same set of 11 skills (8 from [CopilotKit/skills](https://github.com/CopilotKit/skills), 3 from the Manufact reference): `copilotkit-{setup, develop, integrations, debug, upgrade, contribute, agui, self-update}` plus `mcp-builder`, `mcp-apps-builder`, `chatgpt-app-builder`.

To **update** the CopilotKit skills to the latest upstream:

```bash
npx skills add copilotkit/skills --full-depth -y
```

This refreshes `~/.claude/skills/copilotkit-*` and `~/.cursor/skills/copilotkit-*` from the canonical source. The kit's checked-in copies serve as a baseline so a fresh clone works without extra steps.

Reference docs:

- **CopilotKit Coding Agents:** https://docs.copilotkit.ai/coding-agents
- **CopilotKit Skills repo:** https://github.com/CopilotKit/skills
- **Agent Skills standard:** https://agentskills.io
