# Hearth — Technical Spec

**Status:** Draft v0.1
**Date:** 2026-05-09
**Derives from:** `03-functional-spec.md`

This spec defines **how we build** what the functional spec describes. Stack, architecture, data models, API contracts, dependencies, file layout, deployment.

Every feature ID from `03-functional-spec.md` maps to one or more components here.

---

## Stack — locked

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) | CopilotKit GenUI Template uses it; fastest path |
| Styling | **Tailwind 4** | Hackathon velocity |
| Motion | **motion** (`motion/react`) | Repo already depends on Motion 12; use it for spring/layout animations |
| 3D / Shaders | **three.js** + **@react-three/fiber** + **@react-three/drei** | Industry-standard, drei has the helpers we need |
| Audio | **Tone.js** | Crossfade, gain ramps, Player loop |
| AI UI | **CopilotKit v2** (`@copilotkit/react-core/v2`, `@copilotkit/react-ui`) | Required sponsor; AG-UI runtime and frontend tools drive the generative controls |
| Agent runtime | **Existing Hono BFF + CopilotKit Runtime v2 + Python LangGraph agent** | Matches this repo; avoids rebuilding a separate Next API route |
| LLM | **Gemini 3.1 Pro Preview** (`gemini-3.1-pro-preview`) | Mood Architect — structured outputs, thinking, function calling |
| Music gen (stretch) | **Lyria 3 Clip Preview** (`lyria-3-clip-preview`) or Vertex **Lyria 2** (`lyria-002`) | Lyria 3 is current for 30s clips; Lyria 2 remains a Vertex fallback |
| Image gen (stretch) | **Imagen 4 Fast** (`imagen-4.0-fast-generate-001`) / Nano Banana if enabled | Parallax stills |
| Multi-agent | **LangGraph Python already in starter** + **LangSmith** | Runtime is already present; real trace panel is stretch, stylized trace is MVP |
| Schema validation | **Zod** | Validate Gemini structured output |
| State | **React state/Zustand for UI** + **CopilotKit/AG-UI events for agent actions** | Keep the demo deterministic; use shared agent state only where already wired |

---

## File layout

```
vibe-music/
├── apps/
│   ├── frontend/                   # Next.js 15 UI at http://localhost:3010
│   │   ├── src/app/page.tsx         # Replace starter lead app with Hearth app shell
│   │   ├── src/app/layout.tsx       # Existing CopilotKitProviderShell
│   │   ├── src/components/copilot/  # Existing CopilotKit v2 provider/fallbacks
│   │   ├── src/components/hearth/   # New Hearth feature folder
│   │   │   ├── welcome/
│   │   │   ├── transition/
│   │   │   ├── room/
│   │   │   │   └── shaders/
│   │   │   ├── lever-card/
│   │   │   ├── chat/
│   │   │   └── trace/
│   │   ├── src/lib/hearth/          # Zod schema, presets, bindings, audio engine
│   │   └── public/audio/            # Pre-baked loops + SFX
│   ├── bff/                         # Existing Hono CopilotKit Runtime endpoint
│   │   └── src/server.ts            # /api/copilotkit -> LangGraphAgent
│   └── agent/                       # Existing Python LangGraph / Deep Agents backend
│       └── src/                     # Replace lead prompt/tools with Hearth mood tools
├── deployment/                      # Existing Docker infra for CopilotKit Intelligence
├── docs/
│   ├── 01-prd.md
│   ├── 02-user-spec.md
│   ├── 03-functional-spec.md
│   └── 04-technical-spec.md
├── package.json                     # npm workspaces; dev runs frontend+bff+agent
└── README.md                        # async-judge-readable submission README
```

Do **not** scaffold a new root-level `hearth/` app. The fastest path is replacing the starter lead surfaces inside `apps/frontend` while reusing the existing BFF, CopilotKit provider, LangGraph agent process, and dev scripts.

---

## Data models

### `MoodProfile` (Zod schema)

The single source of truth. Both the user (via levers) and the agent (via tools) write to it.

```ts
import { z } from "zod";

export const GoalKind = z.enum([
  "deep_focus",
  "wind_down",
  "creative",
  "energetic",
]);

export const SceneId = z.enum(["forest_cabin", "warm_bedroom"]);

export const Lever = z.object({
  id: z.string(),                          // stable id, e.g. "tempo"
  label: z.string(),                       // user-visible, plain language
  kind: z.enum(["slider", "segmented", "toggle"]),
  description: z.string().optional(),      // hover tooltip
  bindTo: z.string(),                      // dot-path into MoodProfile (e.g. "music.bpm")
  range: z.object({
    min: z.number(),
    max: z.number(),
    default: z.number(),
    step: z.number().optional(),
  }).optional(),                           // for sliders
  options: z.array(z.object({              // for segmented
    value: z.string(),
    label: z.string(),
  })).optional(),
  outOfBoundsAt: z.object({
    lo: z.number().optional(),
    hi: z.number().optional(),
  }).optional(),                           // triggers F-07/F-08
});

export const MoodProfile = z.object({
  goal: z.object({
    kind: GoalKind,
    description: z.string(),
    durationMin: z.number(),
  }),
  music: z.object({
    bpm: z.number(),
    intensity: z.number(),                 // 0-1, drives clip crossfade
    valence: z.number(),                   // -1..1
    aux: z.object({
      brownNoise: z.number(),              // 0-1
      rain: z.number(),                    // 0-1
    }),
    promptForGen: z.string(),              // for stretch Lyria call
  }),
  visual: z.object({
    sceneId: SceneId,
    uniforms: z.object({
      colorTempK: z.number(),
      rainIntensity: z.number(),
      fogDensity: z.number(),
      windowGlow: z.number(),
      timeOfDay: z.number(),
      motionRate: z.number(),
      vignette: z.number(),
    }),
  }),
  levers: z.array(Lever),
  evolution: z.object({
    phase: z.enum(["ramp", "sustain", "wind_down"]),
  }),
});

export type MoodProfile = z.infer<typeof MoodProfile>;
export type Lever = z.infer<typeof Lever>;
```

### Hardcoded presets

`lib/agents/presets.ts` exports two presets:
- `DEEP_FOCUS_PRESET` — used as fallback for F-02, anchor for the cinematic opening
- `WIND_DOWN_PRESET` — used as fallback for F-08 mic-drop regen

These presets are also the source of truth for our seed lever sets (see *User contribution* below).

---

## Architecture

### Frontend ↔ Backend boundary

```
┌─────────────────────── Browser ───────────────────────┐
│                                                        │
│  apps/frontend Next.js page                            │
│    │                                                   │
│    ├── Existing CopilotKitProviderShell                │
│    │     └── runtimeUrl="/api/copilotkit"              │
│    │                                                   │
│    ├── WelcomeScreen   (F-01)                          │
│    ├── CinematicOpening (F-03)                         │
│    └── Room                                            │
│         ├── Scene (r3f)         (F-04)                 │
│         ├── LeverCard           (F-05/F-06)            │
│         ├── ChatPanel           (F-12, CopilotKit UI)  │
│         ├── TracePanel          (F-13)                 │
│         └── AudioEngine (singleton, Tone.js) (F-11)    │
│                                                        │
└─────────────────┬─────────────────┬────────────────────┘
                  │ Next rewrite    │ AG-UI stream
                  ▼                 ▼
┌─────────────────── apps/bff Hono ────────────────────┐
│                                                       │
│  /api/copilotkit                                     │
│    └── CopilotKit Runtime v2                          │
│         └── LangGraphAgent                            │
│              └── apps/agent LangGraph dev server      │
│                   └── Gemini 3.1 Pro Preview          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

`apps/frontend/next.config.ts` already rewrites `/api/copilotkit` to the BFF. Keep that route shape so CopilotKit Intelligence, threads, AG-UI, MCP Apps, and LangGraphAgent keep working.

### State pattern

The local `MoodProfile` is frontend-owned for demo reliability. Both directions write:

- **User → UI:** lever drag mutates `MoodProfile.<path>` locally; scene/audio respond immediately.
- **User/chat → agent:** chat sends current profile summary and the user's request through CopilotKit.
- **Agent → UI:** frontend tools (`updateLeverValue`, `addLever`, `swapScene`, `regenerateMoodProfile`) mutate the same local profile and re-render the controls.

This preserves the **agentic feedback loop** while avoiding a brittle shared-state rewrite during the hackathon. If `useCoAgent` is already cleanly wired in the starter branch, it can replace the local store later without changing the PRD behavior.

---

## Agent contracts

### F-02 — Goal classification call

**Endpoint:** `/api/copilotkit` (Next rewrite → `apps/bff` Hono CopilotKit Runtime → `apps/agent` LangGraph)

**System prompt (excerpt):**
```
You are the Mood Architect for Hearth, a generative mood studio.
Given a user's free-text work goal, emit a MoodProfile JSON object
following this schema: {schema}.

Rules:
- Choose `goal.kind` from: deep_focus, wind_down, creative, energetic.
- Synthesize a `levers` array of 4–6 levers tailored to this specific goal.
  Plain-language labels. No DSP jargon.
- Each lever must declare `outOfBoundsAt` to define when its value implies
  a different mood category (this enables UI regeneration).
- `music.bpm` ranges per goal: deep_focus 60-72, wind_down 50-60,
  creative 70-85, energetic 95-115.
- Pick `visual.sceneId` from: forest_cabin (focus, cool), warm_bedroom (wind-down).
- `promptForGen` is a Lyria prompt: instrumental, mood adjectives, BPM, key signature.
```

**Input:** `{ goal: string, currentMoodProfile?: MoodProfile }`

**Output:** validated `MoodProfile`

**Failure modes:**
- Schema validation fails → retry once → fall back to `DEEP_FOCUS_PRESET`
- Timeout 15s → fall back to preset
- API error → fall back to preset

### F-08 — Regeneration call

Same endpoint, different prompt.

**System prompt (excerpt):**
```
The user's behavior suggests their mood has shifted away from their original
goal. Their original goal was: {original_goal}. Current MoodProfile: {profile}.
Reason for triggering: {reason}.

Emit a NEW MoodProfile reflecting the new mood. Levers should be DIFFERENT
from the previous set (different IDs, different controls), not just different
values. Visual sceneId should change if the mood class changed.
```

**MVP simplification:** the demo path uses a hardcoded swap to `WIND_DOWN_PRESET`. Live agent call is gated behind `NEXT_PUBLIC_USE_LIVE_REGEN=true` for the frontend path or `USE_LIVE_REGEN=true` for backend-only experiments.

### Frontend tools/actions (registered via CopilotKit v2)

Four tool calls the agent can make to manipulate the UI directly from chat. Prefer `useFrontendTool` for frontend-handled tools that mutate the Hearth store/render custom UI; `useCopilotAction` is acceptable for action-only callbacks if already used locally.

| Tool | Args | Effect |
|---|---|---|
| `updateLeverValue` | `{ leverId: string, value: number \| string }` | Mutates the bound path in MoodProfile |
| `addLever` | `{ lever: Lever }` | Appends to `levers[]`, triggers F-09 partial transition |
| `swapScene` | `{ sceneId: SceneId }` | Mutates `visual.sceneId`, triggers F-10 morph |
| `regenerateMoodProfile` | `{ reason: string }` | Swaps to a regenerated/preset `MoodProfile`, triggers F-08/F-09/F-10 |

---

## Audio engine (F-11)

### State machine

```
┌─────────────┐  goalKind=focus   ┌─────────────────┐
│  silent     │ ────────────────▶ │  focus_stack    │
│             │  goalKind=winddwn │  (3-clip xfade) │
└─────────────┘                   └────────┬────────┘
                                           │ regen
                                           ▼
                                  ┌─────────────────┐
                                  │  winddown_clip  │
                                  └─────────────────┘
```

### Implementation

```ts
class AudioEngine {
  private players = {
    focusLow: new Tone.Player({ url: "/audio/loop_focus_low.mp3", loop: true }),
    focusMid: new Tone.Player({ url: "/audio/loop_focus_mid.mp3", loop: true }),
    focusHigh: new Tone.Player({ url: "/audio/loop_focus_high.mp3", loop: true }),
    windDown: new Tone.Player({ url: "/audio/loop_winddown.mp3", loop: true }),
    rain: new Tone.Player({ url: "/audio/texture_rain.mp3", loop: true }),
    brownNoise: new Tone.Player({ url: "/audio/texture_brown_noise.mp3", loop: true }),
  };
  private gains: Record<string, Tone.Gain> = { /* per-clip Gain */ };

  applyProfile(p: MoodProfile) {
    const intensity = p.music.intensity;        // 0-1
    if (p.goal.kind === "wind_down") {
      this.crossfadeTo("windDown", 2.0);
    } else {
      // 3-way crossfade across low/mid/high based on intensity
      this.gains.focusLow.gain.rampTo(triangleAt(intensity, 0.0), 0.25);
      this.gains.focusMid.gain.rampTo(triangleAt(intensity, 0.5), 0.25);
      this.gains.focusHigh.gain.rampTo(triangleAt(intensity, 1.0), 0.25);
    }
    this.gains.rain.gain.rampTo(p.music.aux.rain, 0.25);
    this.gains.brownNoise.gain.rampTo(p.music.aux.brownNoise, 0.25);
  }
}
```

`triangleAt(x, peak)` returns 1 at `peak`, falls to 0 over a 0.5 window.

---

## Shader scenes (F-04)

### Approach

Per scene: one fragment shader, ~150 lines GLSL. Vertex shader is a shared full-screen quad (`shared.vert.glsl`).

The shader receives uniforms from `MoodProfile.visual.uniforms`. We use `r3f`'s `useFrame` to lerp uniform values toward target each frame.

### Forest cabin shader sketch

```glsl
uniform float uColorTempK;       // 2700-6500
uniform float uRainIntensity;    // 0-1
uniform float uFogDensity;
uniform float uWindowGlow;
uniform float uTimeOfDay;
uniform float uMotionRate;
uniform float uVignette;
uniform vec2 uResolution;
uniform float uTime;

vec3 cabin_view(vec2 uv) { /* layered SDF + procedural noise */ }
vec3 rain(vec2 uv, float intensity, float t) { /* falling streaks */ }
vec3 fog(vec3 col, float d) { /* exp fog */ }
vec3 vignette(vec3 col, vec2 uv, float strength) { /* radial darken */ }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec3 col = cabin_view(uv);
  col += rain(uv, uRainIntensity, uTime * uMotionRate);
  col = fog(col, length(uv - vec2(0.5)) * uFogDensity);
  col *= colorTempTint(uColorTempK);
  col = vignette(col, uv, uVignette);
  gl_FragColor = vec4(col, 1.0);
}
```

For MVP, the cabin scene is the only one with custom shader work; the bedroom can be a recolored variant + different overlay sprite.

### Overlays

Per-scene PNG overlays (cabin window frame, bedroom bed silhouette) are positioned via absolute CSS over the canvas. Crossfaded during F-10.

---

## Cinematic transition (F-03)

Implementation: Motion (`motion/react`) driving:
- One uniform tween chain (8 stops over 8s) for the shader
- One opacity timeline for the goal text
- Audio gain ramps via `Tone.Player.volume.rampTo`

A single `<TransitionDirector>` component owns the timeline. Component unmounts at t=8s, hands off to `<Room>`.

---

## Dependencies

```json
{
  "alreadyInRepo": {
    "next": "^15.5.15",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "@copilotkit/react-core": "latest",
    "@copilotkit/react-ui": "latest",
    "@copilotkit/runtime": "latest",
    "motion": "^12.23.12",
    "zod": "^3.25.76",
    "tailwindcss": "^4.1.12",
    "lucide-react": "^0.542.0"
  },
  "addToAppsFrontend": {
    "three": "^0.181.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "tone": "^15.0.0",
    "zustand": "^5.0.0"
  },
  "stretchOnly": {
    "@google/genai": "^1.0.0"
  }
}
```

Do not downgrade existing starter dependencies mid-build. Add only the frontend packages required for the room/audio experience. If live Gemini calls stay in the Python agent, use `langchain-google-genai` already present in `apps/agent` rather than adding a second TypeScript Gemini path.

---

## Environment variables

```
GEMINI_API_KEY=...                # required, MVP
COPILOTKIT_LICENSE_TOKEN=...      # from `npx copilotkit@latest license`
INTELLIGENCE_API_KEY=...          # existing local/dev CopilotKit Intelligence key
LANGSMITH_API_KEY=...             # optional MVP / stretch trace wiring
GOOGLE_PROJECT_ID=...             # stretch — Vertex Lyria 2 fallback
GOOGLE_CLOUD_LOCATION=us-central1 # stretch — Vertex Lyria 2 fallback
NEXT_PUBLIC_USE_LIVE_REGEN=false  # frontend gate for F-08 live agent vs preset
NEXT_PUBLIC_USE_LYRIA=false       # frontend gate for F-16
```

---

## Build and run

```bash
# install
npm install

# dev (http://localhost:3010)
npm run dev

# production build (test before demo)
npm run build && npm start
```

`npm run dev` starts Docker infra, the frontend, BFF, and Python LangGraph agent. Run a production build at 4:00 PM as a smoke test before the 5:00 PM record.

---

## Deployment

For demo: **localhost is fine.** No Vercel deploy required. The submission is the GitHub repo + video.

If we want a live URL post-hackathon:
- Vercel deploy of the Next.js app
- BFF deploy as a Node service or serverless function compatible with Hono
- Audio assets served from Vercel static (sub-1MB total)

---

## Implementation order (locked)

| # | Step | Time | Maps to |
|---|---|---|---|
| 1 | Verify starter boots, env keys, and `/api/copilotkit` rewrite | 0.25h | infra |
| 2 | Add only missing frontend deps: r3f, drei, three, Tone, Zustand | 0.25h | infra |
| 3 | Define `MoodProfile` schema, presets, local store, path binding helper | 0.45h | data |
| 4 | Replace starter page with Hearth shell + welcome/goal entry | 0.35h | F-01 |
| 5 | Switch agent model/prompt to Hearth Mood Architect; keep preset fallback | 0.50h | F-02 |
| 6 | Build one polished cabin room with shader/CSS overlay; bedroom is palette+overlay | 0.90h | F-04/F-10 |
| 7 | Build LeverCard controls and live bindings | 0.70h | F-05/F-06 |
| 8 | Add Tone.js pre-baked loop/rain/noise crossfade | 0.45h | F-11 |
| 9 | Add 6s cinematic transition and goal pill | 0.55h | F-03/F-14 |
| 10 | Add out-of-bounds timer, preset regen, card swap, scene morph | 0.55h | F-07/F-08/F-09/F-10 |
| 11 | Add CopilotKit chat with frontend tools for profile mutations | 0.40h | F-12 |
| 12 | Add truthful stylized trace panel and README/demo polish | 0.60h | F-13/docs/QA |
| **Total MVP** | | **5.95h** | |

If behind at the 4-hour mark, cut in this order: live Gemini classification (preset only, but keep prompt in README), trace panel animation, bedroom overlay detail, custom chat styling. Do not cut the lever regeneration moment.

---

## Risks (technical)

| Risk | Mitigation |
|---|---|
| Shader takes > 1.5h to look good | Start with a known-working glslsandbox shader as base; iterate rather than write from scratch |
| Tone.js audio context unlock | Trigger `Tone.start()` on first user click in welcome screen |
| Gemini 3.1 Pro Preview structured output not honoring schema | Zod parse + retry once + fallback preset; keep hardcoded demo path viable |
| Agent/UI state stale during rapid drags | Frontend store is source of truth during drag; agent updates apply only after release/idle |
| Motion timeline drift | Drive the cinematic from elapsed time/state transitions, not chained implicit delays |

---

## Approved lever sets (locked 2026-05-09)

The two seed presets in `lib/agents/presets.ts`:

### `DEEP_FOCUS_PRESET.levers`
1. **Tempo** — slider, 60–72 BPM, default 65, OOB at lo=55 (triggers regen)
2. **Rain intensity** — slider, 0–1, default 0.4
3. **Harmonic density** — slider, drone (0) ↔ jazzy (1), default 0.3
4. **Brown noise** — slider, 0–1, default 0.0
5. **Window view** — segmented [forest / cabin / ocean], default "forest"

### `WIND_DOWN_PRESET.levers`
1. **Valence** — slider, melancholy (-1) ↔ hopeful (+1), default -0.2
2. **Pad density** — slider, sparse (0) ↔ lush (1), default 0.6
3. **Candlelight flicker** — slider, 0–1, default 0.5
4. **Breathing pace** — toggle (match-breath on/off) + slider 4–12 breaths/min, default 6
5. **Ambient warmth** — slider, color temp 2700K ↔ 3500K, default 2900K

**Design rationale:** the two sets share *zero lever IDs*. Every label changes when the regen fires, so the UI swap reads as a category change, not just a value change. The OOB threshold on tempo is the single demo-path trigger.

---

## Acceptance criteria for technical spec

- [ ] User confirms stack and version locks
- [ ] User confirms file layout
- [ ] User confirms `MoodProfile` schema (or proposes schema changes)
- [ ] User confirms implementation order
- [ ] User picks 4–6 levers per preset (above)

Once approved, **code begins.**
