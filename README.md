# Hearth

> **A conversational, generative mood studio for focus work.** Tell it what you're doing; an agent ensemble synthesizes a personalized "room" — original ambient music, a live WebGL scene, and a **goal-specific control surface** — that you steer in real time.
>
> *"claude-music finds you a station. Hearth builds you a room."*

Built in 6 hours at the **AI Tinkerers SF — Generative UI Global Hackathon (Agentic Interfaces)**, May 9 2026.

<!-- 5 PM: drop demo video URL here, hero screenshot below -->

---

## The pitch

It's 8 PM. You're three hours into a concurrency bug that doesn't want to be found. You reach for lo-fi girl, or brain.fm, or whatever's queued in Spotify, and the music plays. It is the same music that played last night when you were writing a wedding toast, and the same music that will play tomorrow when you're sketching architecture.

You don't get to say what kind of attention this task needs. You get a genre tag and a play button. The sliders, if there are any, were drawn by a designer last quarter for an average user who isn't you, doing a task that isn't this.

**Hearth is the version where you describe the work and the room shows up.** Original ambient music. A live scene through a window. And a control surface that was *generated for this goal*. *Tempo, rain, harmonic density, brown noise* — for "debugging concurrency." *Candlelight flicker, breathing pace, ambient warmth* — for "wind down before bed." The two sets share zero controls because there is nothing to bind a candle slider to until the room has candles.

Push a control past where it makes sense for what you said you were doing. The agent notices, throws the entire control surface out, and grows you a new one. **Different controls. Different scene. Same conversation.**

That last move — the affordance set itself regenerating in response to your behavior — is the thing a chatbot cannot do, and the thing a designer cannot draw upfront. It's also what we built today.

---

## For the impatient judge — 30 seconds

1. The user types a free-text goal (`debugging concurrency for 90 minutes`).
2. An agent emits a `MoodProfile` — picks the scene, picks the music, **picks the controls themselves**.
3. The room materializes. The user drags a lever; audio + visuals respond live.
4. The user pushes a lever past where it makes sense for *this goal*. **The agent regenerates: a new control surface, with different controls, swaps in. The scene morphs.**

That last step is the win state. A designer cannot draw it upfront. A chatbot cannot render it. That's the entire submission.

---

## The Figma Test

The hackathon brief sets one bar: *could a designer have drawn these screens upfront in Figma?* If yes, it's a regular app pretending to be generative UI. The control surface in Hearth fails that test by construction:

| Goal you typed | Levers the agent drew for you |
|---|---|
| `debugging concurrency for 90 minutes` | Tempo · Rain intensity · Harmonic density · Brown noise · Window view |
| `wind down before bed` | Valence · Pad density · Candlelight flicker · Breathing pace · Ambient warmth |
| `creative writing sprint` | Tempo · Lyricality · Texture grit · Coffee-shop chatter · Time of day |

Different goals get different *levers*, not different *values*. The agent picked them, named them, scoped their valid range, and decided which one — when crossed — implies the user has shifted moods entirely. That's the part a designer cannot pre-draw, because **the content is a function of what the agent decided in the moment.**

---

## The wow loop (the 60-second demo arc)

Every other decision in this build was optimized against this arc:

| t | What happens | Why it matters |
|---|---|---|
| 0:00 | User types `debugging concurrency for 90 minutes` and hits **Build my room**. | The control surface doesn't exist yet. |
| 0:05 | Cinematic transition: forest cabin fades in — rain on the window, fog, color temp 2700K. Audio crossfades from silence into low-intensity focus loop + rain texture. | Multi-sensory wow on first frame. |
| 0:12 | **Lever Card appears.** Five levers the agent picked for *this* goal. The user drags Rain — shader rain intensifies, audio rain texture rises in the same frame. | Agentic feedback loop, visible. |
| 0:25 | User types in chat: *"less melodic, more drone."* Agent calls `updateLeverValue` on Harmonic density. The room responds. | Free-form chat ↔ generative controls — the loop closes both ways. |
| 0:40 | **Mic-drop.** User pushes Tempo down past 55 BPM (out-of-bounds for deep focus). The Lever Card animates out, the cabin morphs into a warm bedroom, and a **new Lever Card with completely different controls** swaps in — Valence, Pad density, Candlelight flicker, Breathing pace, Ambient warmth. | The affordance set itself just regenerated. **This is the submission.** |

---

## Differentiation

| | Spotify focus | Brain.fm / Endel | claude-music | **Hearth** |
|---|---|---|---|---|
| Surface | Mobile / web | Mobile app | Terminal CLI | **Web, full-screen ambient** |
| Music | Curated playlists | Procedural | Pre-existing radio | **Selected per goal** |
| Visuals | Album art | Static gradients | None | **Live WebGL scene** |
| Control surface | Static buttons | Fixed sliders | Slash commands | **Generated per goal** |
| Affordance regen mid-session | None | None | None | **Yes — controls change category** |
| Agentic feedback loop | None | None | None | **Yes — bidirectional shared state** |

---

## Stack

We deliberately stacked **multiple sponsor surfaces** rather than picking one. Each does what it's best at; the seams stay clean.

| Layer | Tech | Role |
|---|---|---|
| Generative UI runtime | **CopilotKit v2 / AG-UI** | Streams agent tool calls into the React tree. Hosts the chat sidebar. |
| Agent brain | **Gemini 3.1 Pro Preview** + **LangGraph** | Mood Architect — classifies goal, emits structured `MoodProfile`, picks the lever set. |
| Agent traces | **LangSmith** | Tool calls visible in the chat sidebar; full trace per turn. |
| 3D / shaders | **three.js + @react-three/fiber** | Forest cabin and warm bedroom. Shader uniforms bind to `MoodProfile.visual.uniforms`, lerped per frame. |
| Audio | **Tone.js** | 3-way crossfade across pre-baked focus loops by `music.intensity`; rain + brown-noise textures gated by `music.aux.*`. |
| State / schema | **Zustand + Zod** (frontend) / **Pydantic** (agent) | One `MoodProfile` schema mirrored on both sides. |
| Motion | **motion/react** | 8-second cinematic transition; Lever Card swap. |
| MCP surface | **Manufact / mcp-use** | Wired in `apps/mcp/` as a third agent surface (Claude/ChatGPT). Not on the demo path. |

**On latency-optimized rendering** (a judging dimension that namedrops models that don't publicly exist): we mention KV cache and streaming here and built nothing for it. That budget went into the wow loop. Per the handbook, this is the trap we declined.

---

## Architecture

```
┌──────────────────────────── Browser ──────────────────────────────┐
│                                                                    │
│  apps/frontend (Next.js 15, App Router)                            │
│    │                                                               │
│    ├── CopilotKitProviderShell ───── runtimeUrl=/api/copilotkit    │
│    │                                                               │
│    ├── WelcomeScreen           (free-text goal entry)              │
│    ├── CinematicTransition     (8-second materialize)              │
│    └── Room                                                        │
│         ├── Scene (r3f + GLSL)         ← uniforms ← MoodProfile    │
│         ├── LeverCard                  ← levers[] ← MoodProfile    │
│         │     └── useLeverBinding      → MoodProfile (drag)        │
│         ├── ChatPanel (CopilotSidebar)                             │
│         └── AudioEngine (Tone.js)      ← music    ← MoodProfile    │
│                                                                    │
│    ┌──────────────────── shared state ────────────────────────┐    │
│    │ useHearthStore (Zustand) — single source of truth         │    │
│    │   profile: MoodProfile                                    │    │
│    │   setLeverValue / applyProfile / addLever / swapScene     │    │
│    └───────────────────────────────────────────────────────────┘    │
│                            ▲                                       │
│                            │ frontend tools (4) — registered via   │
│                            │ useFrontendTool, called by the agent: │
│                            │   updateLeverValue                    │
│                            │   addLever                            │
│                            │   swapScene                           │
│                            │   regenerateMoodProfile (signal)      │
│                            │ + agent.state.profile → store bridge  │
└────────────────────────────┼───────────────────────────────────────┘
                             │ AG-UI (SSE) over /api/copilotkit
                             ▼
┌──────────────────── apps/bff (Hono) ──────────────────────────────┐
│                                                                    │
│  CopilotKit Runtime v2                                             │
│    └── LangGraphAgent ── LANGGRAPH_DEPLOYMENT_URL                  │
│                                                                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │ LangGraph SDK
                             ▼
┌──────────────── apps/agent (Python LangGraph) ────────────────────┐
│                                                                    │
│  Mood Architect graph                                              │
│    ├── MoodStateMiddleware  ── ships state.profile in snapshots    │
│    ├── Backend tools                                               │
│    │     classify_mood_for_goal(goal) → Command(profile=…)         │
│    │     regenerate_mood_profile(reason) → Command(profile=…)      │
│    └── Gemini 3.1 Pro Preview (structured JSON output)             │
│                                                                    │
│  Direct-call helpers (bypass planner for F-02 / F-08):             │
│    architect.classify_goal(text)         → MoodProfile             │
│    architect.regenerate_for_reason(...)  → MoodProfile             │
│                                                                    │
│  Validation: Pydantic + retry once + preset fallback (always-up)   │
└────────────────────────────────────────────────────────────────────┘
```

### The shared contract

Both sides validate against the same shape:

- **Frontend (Zod):** [`apps/frontend/src/lib/hearth/schema.ts`](apps/frontend/src/lib/hearth/schema.ts)
- **Agent (Pydantic):** [`apps/agent/src/hearth/schema.py`](apps/agent/src/hearth/schema.py)
- **Sample profile:** [`docs/samples/sample-mood-profile.json`](docs/samples/sample-mood-profile.json) — what the store boots with so the room renders before the agent has spoken.

```ts
MoodProfile = {
  goal:    { kind, description, durationMin },
  music:   { bpm, intensity, valence, aux: { rain, brownNoise }, promptForGen },
  visual:  { sceneId, uniforms: { colorTempK, rainIntensity, fogDensity, ... } },
  levers:  Lever[]   // 4–6, agent-picked, with `outOfBoundsAt` thresholds
  evolution: { phase: "ramp" | "sustain" | "wind_down" }
}
```

### The agent → UI bridge

The agent's structured output lands in `state.profile` via [`MoodStateMiddleware`](apps/agent/src/hearth/mood_state.py). On the frontend, [`useAgentProfileBridge`](apps/frontend/src/components/copilot/hearth-tools.tsx) validates each AG-UI snapshot through Zod and pushes it into the Zustand store. That's how welcome-screen classification (F-02) and the mic-drop regen (F-08) actually reach the scene shader and the audio engine.

### Why a frontend-owned store

`MoodProfile` is the source of truth on the **client**. Lever drags mutate it locally and audio/visuals respond in the same frame — no round-trip latency. The agent contributes by calling frontend tools or by emitting a fresh profile through state. We picked this over `useCoAgent` shared state for demo reliability: rapid drags can't race against agent-side updates.

---

## What we built today vs starter

Per the handbook ("judges weigh transparency about pre-existing code"), we're loud about the split. Starter is the [CopilotKit Generative UI Hackathon Starter Kit](https://github.com/CopilotKit/genai-starterkit-hackathon-template) — a Next.js + Hono BFF + Python LangGraph monorepo with a "Notion leads" example app.

### Kept from the starter
- Next.js 15 + Hono BFF + Python LangGraph monorepo skeleton
- CopilotKit v2 provider, AG-UI runtime wiring, dev-script orchestration
- Postgres + Redis docker infra for thread persistence
- Gemini key failover (`apps/agent/src/gemini_keys.py`)

### Built in the 6 hours (everything Hearth)
- `MoodProfile` schema in **Zod + mirrored Pydantic**, sample profile committed for offline rendering
- **Mood Architect agent**: prompts, structured-output JSON mode, retry + preset fallback ([`apps/agent/src/hearth/architect.py`](apps/agent/src/hearth/architect.py))
- **Two presets** (`DEEP_FOCUS_PRESET`, `WIND_DOWN_PRESET`) — also the regen targets when the live model fails. Lever ID sets are disjoint by design so the regen always reads as a category change.
- `MoodStateMiddleware` shipping `state.profile` snapshots through AG-UI ([`apps/agent/src/hearth/mood_state.py`](apps/agent/src/hearth/mood_state.py))
- Frontend **Zustand store** with dot-path mutation ([`apps/frontend/src/lib/hearth/store.ts`](apps/frontend/src/lib/hearth/store.ts))
- **Four CopilotKit frontend tools** + agent-state → store bridge ([`apps/frontend/src/components/copilot/hearth-tools.tsx`](apps/frontend/src/components/copilot/hearth-tools.tsx))
- **WebGL scenes** (forest cabin polished, warm bedroom recolored), Lever Card components, Tone.js audio engine, Motion cinematic transition

The pre-existing lead-triage canvas is left in place where it doesn't conflict; it does not appear in the demo path.

---

## Try it

**Prereqs:** Node 20+, Python 3.10+, [`uv`](https://docs.astral.sh/uv/getting-started/installation/), Docker Desktop running.

```bash
cp .env.example .env && cp apps/agent/.env.example apps/agent/.env
# Add GEMINI_API_KEYS and COPILOTKIT_LICENSE_TOKEN to both files.

npm install
npm run dev
```

Open http://localhost:3010 and try one of these:

```
debugging concurrency for 90 minutes
wind down before bed
creative writing sprint, 25 min pomodoro
```

Then drag the Tempo lever past its lower bound. Watch the room regenerate.

> No `GEMINI_API_KEYS`? The agent serves the validated `DEEP_FOCUS_PRESET`. The wow loop still runs (regen swaps to `WIND_DOWN_PRESET` deterministically) — just non-live.

For deeper guides see [`dev-docs/`](dev-docs/) (architecture, model switching, threads, troubleshooting).

---

## Submission

| | |
|---|---|
| Event | AI Tinkerers SF — Generative UI Global Hackathon, May 9 2026 |
| Track | Agentic Interfaces |
| Repo | this one |
| Demo video | _(linked at the top — recorded 5:00 PM PT)_ |
| Team | Dawgs at Hackathon |

## License

MIT.

---

> Built for the **Generative UI Global Hackathon: Agentic Interfaces** — AI Tinkerers SF, May 2026. The UI is the agent's output.
