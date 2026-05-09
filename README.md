# Hearth

**A conversational, generative mood studio for focus work.** You describe what you're working on; an agent ensemble synthesizes a personalized "room" — original ambient music, a live WebGL scene, and a *goal-specific control surface* — and you steer it in real time.

> *"claude-music finds you a station. Hearth builds you a room."*

Built in 6 hours at the **AI Tinkerers SF — Generative UI Global Hackathon (Agentic Interfaces)**, May 9 2026.

<!-- Demo video lands here at H5. Hero screenshot below. -->

---

## Why this isn't a chatbot

Brain.fm gives you sliders a designer drew last quarter. Spotify gives you playlists curated last month. Both ship the same controls whether you're debugging concurrency or writing your wedding toast.

In Hearth, **the control surface is the agent's output**:

- "Debugging concurrency for 90 minutes" → **Tempo · Rain · Harmonic density · Brown noise · Window view**
- "Wind down before bed" → **Valence · Pad density · Candlelight flicker · Breathing pace · Ambient warmth**

Different goals get different *levers*, not different *values*. Push a lever past where it makes sense for your goal and the agent regenerates — the entire control surface animates out and a new one with **different controls** replaces it. The room morphs underneath.

A designer cannot draw these screens upfront. That's the whole point.

---

## The wow loop

The 60-second demo arc — and the thing we optimized every other decision against:

1. **Goal entry.** User types `debugging concurrency for 90 minutes` and hits *Build my room*.
2. **Cinematic materialize.** A forest cabin scene fades in — rain on the window, warm interior glow, color temperature drops to 2700K. Audio crossfades from silence into low-intensity focus loop + rain texture.
3. **Lever Card appears.** Five levers the agent picked for *this* goal: Tempo, Rain, Harmonic density, Brown noise, Window view. The user drags Rain — the shader rain intensifies, the audio rain texture rises. **Tight feedback loop, agent-generated controls.**
4. **The mic-drop.** User pushes Tempo down past 55 BPM (out-of-bounds for deep focus). The agent regenerates: the Lever Card animates out, the cabin scene morphs into a warm bedroom, and a new Lever Card appears with **completely different controls** — Valence, Pad density, Candlelight flicker, Breathing pace, Ambient warmth. **The affordance set itself just regenerated.**
5. **Free-form steering.** User types in chat: *"less melodic, more drone"*. The agent calls `updateLeverValue` on Pad density and Harmonic density and the room responds.

Every screen failed the **Figma Test**: a designer could not have drawn them upfront because their content depends on what the agent decided in the moment.

---

## Stack

We deliberately stacked **multiple sponsor surfaces** rather than picking one — each does what it's best at, and the seams stay clean.

| Surface | Tech | What it does |
|---|---|---|
| Generative UI runtime | **CopilotKit v2 / AG-UI** | Streams the agent's frontend tool calls (`updateLeverValue`, `addLever`, `swapScene`, `regenerateMoodProfile`) into the React tree. Drives the chat sidebar. |
| Agent brain | **Gemini 3.1 Pro Preview** + **LangGraph** (Python) | Mood Architect — classifies the goal, emits a structured `MoodProfile`, picks the lever set. Falls back to validated presets on parse failure. |
| Agent traces | **LangSmith** | Visible tool calls in the chat sidebar; full trace per turn. |
| 3D / shaders | **three.js + @react-three/fiber** | The forest-cabin and warm-bedroom scenes. Shader uniforms are bound to `MoodProfile.visual.uniforms` and lerped per frame. |
| Audio | **Tone.js** | 3-way crossfade across pre-baked focus loops by `music.intensity`, plus rain/brown-noise textures gated by `music.aux.*`. |
| State / schema | **Zustand + Zod (frontend)** / **Pydantic (agent)** | One `MoodProfile` schema mirrored on both sides. Frontend-owned for demo reliability; agent mutates via tool calls. |
| Motion | **motion/react** | Cinematic transition (8s timeline) and Lever Card swap-out. |

**On the latency-optimized rendering trap** (a judging dimension that namedrops models that don't publicly exist): we mention KV cache and streaming here and built nothing for it. That budget went into the wow loop instead.

---

## Architecture

```
┌────────────────────────── Browser ────────────────────────────┐
│                                                                │
│  apps/frontend (Next.js 15, App Router)                        │
│    │                                                           │
│    ├── CopilotKitProviderShell ─── runtimeUrl=/api/copilotkit  │
│    │                                                           │
│    ├── WelcomeScreen          (goal entry)                     │
│    ├── CinematicTransition    (8s materialize)                 │
│    └── Room                                                    │
│         ├── Scene (r3f + GLSL)        ← uniforms ← MoodProfile │
│         ├── LeverCard                 ← levers[] ← MoodProfile │
│         │     └── useLeverBinding     → MoodProfile (drag)     │
│         ├── ChatPanel (CopilotSidebar)                         │
│         └── AudioEngine (Tone.js)     ← music   ← MoodProfile  │
│                                                                │
│    ┌──────────────────── shared state ────────────────────┐    │
│    │ useHearthStore (Zustand)                              │    │
│    │   profile: MoodProfile                                │    │
│    │   setLeverValue / applyProfile / addLever / swapScene │    │
│    └───────────────────────────────────────────────────────┘    │
│                            ▲                                   │
│                            │ frontend tools (4)                │
│                            │   updateLeverValue                │
│                            │   addLever                        │
│                            │   swapScene                       │
│                            │   regenerateMoodProfile           │
│                            │ + agent.state.profile bridge      │
└────────────────────────────┼───────────────────────────────────┘
                             │ AG-UI (SSE)
                             ▼
┌────────────────── apps/bff (Hono) ─────────────────────────────┐
│                                                                 │
│  /api/copilotkit                                                │
│    └── CopilotKit Runtime v2                                    │
│         └── LangGraphAgent ── LANGGRAPH_DEPLOYMENT_URL          │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ LangGraph SDK
                             ▼
┌────────────────── apps/agent (Python LangGraph) ───────────────┐
│                                                                 │
│  Mood Architect graph                                           │
│    ├── MoodStateMiddleware  ── ships state.profile in snapshots │
│    ├── Backend tools                                            │
│    │     classify_mood_for_goal(goal) → Command(profile=…)      │
│    │     regenerate_mood_profile(reason) → Command(profile=…)   │
│    └── Gemini 3.1 Pro Preview (structured JSON output)          │
│                                                                 │
│  Direct-call helpers (bypass planner for F-02 / F-08):          │
│    architect.classify_goal(text)         → MoodProfile          │
│    architect.regenerate_for_reason(...)  → MoodProfile          │
│                                                                 │
│  Validation: Pydantic MoodProfile + retry once + preset fallback│
└─────────────────────────────────────────────────────────────────┘
```

**The shared contract:** `apps/frontend/src/lib/hearth/schema.ts` (Zod) and `apps/agent/src/hearth/schema.py` (Pydantic) describe the same `MoodProfile`. A sample profile lives at [`docs/samples/sample-mood-profile.json`](docs/samples/sample-mood-profile.json) and is what the store boots with so the room renders before the agent has spoken.

**The agent → UI bridge.** The agent's structured output lands in `state.profile` via `MoodStateMiddleware`. The frontend's [`useAgentProfileBridge`](apps/frontend/src/components/copilot/hearth-tools.tsx) validates each snapshot against Zod and pushes it into the Zustand store. That's how the welcome-screen classification (F-02) and mic-drop regen (F-08) actually reach the scene and audio engine.

---

## Built today vs starter

Per the handbook, we're loud about what was pre-existing. The starter is the [CopilotKit Generative UI Hackathon Starter Kit](https://github.com/CopilotKit/genai-starterkit-hackathon-template) — a Next.js + Hono BFF + Python LangGraph monorepo with CopilotKit v2, AG-UI, and an example "Notion leads" canvas app.

**What we kept from the starter:**
- Next.js 15 + Hono BFF + Python LangGraph monorepo skeleton
- CopilotKit v2 provider, AG-UI runtime wiring, dev-script orchestration
- Postgres/Redis docker infra for thread persistence
- Gemini key failover (`gemini_keys.py`)

**What we built in the 6 hours (all under `hearth/` namespaces):**
- `MoodProfile` schema in Zod + mirrored Pydantic, with a sample committed for offline rendering
- Mood Architect agent: prompts, structured-output JSON mode, retry + preset fallback (`apps/agent/src/hearth/architect.py`)
- Two presets (`DEEP_FOCUS_PRESET`, `WIND_DOWN_PRESET`) — also the regen targets when the live model fails
- `MoodStateMiddleware` shipping `state.profile` snapshots through AG-UI
- Frontend Zustand store with dot-path mutation (`apps/frontend/src/lib/hearth/store.ts`)
- Four CopilotKit frontend tools (`updateLeverValue`, `addLever`, `swapScene`, `regenerateMoodProfile`) and the agent-state → store bridge ([`hearth-tools.tsx`](apps/frontend/src/components/copilot/hearth-tools.tsx))
- Welcome screen with goal entry that submits the user's text into the agent loop
- WebGL scenes (forest cabin, warm bedroom), Lever Card, audio engine, cinematic transition

The pre-existing lead-triage canvas was left alone where it didn't conflict; it doesn't appear in the demo path.

---

## Run it locally

**Prereqs:** Node 20+, Python 3.10+, [`uv`](https://docs.astral.sh/uv/getting-started/installation/), Docker Desktop running.

```bash
cp .env.example .env && cp apps/agent/.env.example apps/agent/.env
# Add GEMINI_API_KEYS and COPILOTKIT_LICENSE_TOKEN to both .env files.
# (Without GEMINI_API_KEYS the agent serves the validated presets — the
#  demo path still works, just non-live.)

npm install
npm run dev
```

Open http://localhost:3010, type `debugging concurrency for 90 minutes`, and run the wow loop above.

For the pre-flight check, model swap, MCP server, and troubleshooting, see [`dev-docs/`](dev-docs/).

---

## Sponsor surfaces, in one line each

- **CopilotKit / AG-UI** — runtime that streams agent tool calls into the React tree.
- **Gemini 3.1 Pro Preview** — Mood Architect, structured output for `MoodProfile`.
- **LangGraph + LangSmith** — agent runtime + visible traces in the chat sidebar.
- **Manufact / mcp-use** — wired in `apps/mcp/` for the MCP-Apps surface; not on the demo path.

---

## License

MIT.

---

> Built for the **Generative UI Global Hackathon: Agentic Interfaces** — AI Tinkerers SF, May 2026.
