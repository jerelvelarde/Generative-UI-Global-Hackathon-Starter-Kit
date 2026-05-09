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
| Motion | **Framer Motion** | Spring physics, layout animations, AnimatePresence |
| 3D / Shaders | **three.js** + **@react-three/fiber** + **@react-three/drei** | Industry-standard, drei has the helpers we need |
| Audio | **Tone.js** | Crossfade, gain ramps, Player loop |
| AI UI | **CopilotKit v2** (`@copilotkit/react-core`, `@copilotkit/react-ui`) | Required sponsor; `useCoAgent` is our shared-state primitive |
| Agent runtime | **CopilotKit Runtime** (`@copilotkit/runtime`) | Glue between Next.js API route and Gemini |
| LLM | **Gemini 3.1 Pro** (`@google/genai` v1) | Mood Architect — preview API, MEDIUM thinking level |
| Music gen (stretch) | **Lyria 2** via Vertex AI | 30s WAV @ 48kHz, perfect for crossfade |
| Image gen (stretch) | **Imagen 4 Fast** via Gemini API | Parallax stills |
| Multi-agent (stretch) | **LangGraph** (`@langchain/langgraph`) + **LangSmith** | Visible trace, sponsor credit |
| Schema validation | **Zod** | Validate Gemini structured output |
| State | **CopilotKit shared state** + **Zustand** for UI-only state | useCoAgent for MoodProfile; Zustand for ephemeral UI |

---

## File layout

```
hearth/
├── app/
│   ├── layout.tsx                  # CopilotKitProvider + global styles
│   ├── page.tsx                    # Single-page app (welcome ↔ room)
│   ├── api/
│   │   └── copilotkit/route.ts     # CopilotKit runtime endpoint (Gemini-backed)
│   └── globals.css                 # Tailwind base + custom CSS vars
├── components/
│   ├── welcome/
│   │   ├── WelcomeScreen.tsx       # F-01
│   │   └── GoalInput.tsx
│   ├── transition/
│   │   └── CinematicOpening.tsx    # F-03 — Framer Motion timeline
│   ├── room/
│   │   ├── Room.tsx                # F-04 root
│   │   ├── ForestCabinScene.tsx    # F-04 scene
│   │   ├── WarmBedroomScene.tsx    # F-04 scene
│   │   ├── shaders/
│   │   │   ├── forest_cabin.frag.glsl
│   │   │   ├── warm_bedroom.frag.glsl
│   │   │   └── shared.vert.glsl
│   │   ├── GoalPill.tsx            # F-14
│   │   └── IdleFade.tsx            # F-15
│   ├── lever-card/
│   │   ├── LeverCard.tsx           # F-05 / F-09
│   │   ├── LeverSlider.tsx
│   │   ├── LeverSegmented.tsx
│   │   ├── LeverToggle.tsx
│   │   └── useLeverBinding.ts      # F-06
│   ├── chat/
│   │   └── ChatPanel.tsx           # F-12, wraps CopilotPopup or CopilotChat
│   └── trace/
│       └── TracePanel.tsx          # F-13
├── lib/
│   ├── audio/
│   │   ├── AudioEngine.ts          # F-11 — Tone.js setup + crossfade
│   │   └── clips.ts                # clip metadata + paths
│   ├── agents/
│   │   ├── moodArchitect.ts        # F-02 / F-08 — single Gemini call
│   │   ├── presets.ts              # hardcoded MoodProfile fallbacks
│   │   ├── promptTemplates.ts      # system prompts
│   │   └── schema.ts               # Zod schemas — MoodProfile + Lever
│   ├── genui/
│   │   ├── outOfBounds.ts          # F-07 detection
│   │   └── regenerate.ts           # F-08 trigger
│   └── types/
│       └── mood-profile.ts         # TypeScript types (re-exported from Zod)
├── public/
│   └── audio/
│       ├── loop_focus_low.mp3
│       ├── loop_focus_mid.mp3
│       ├── loop_focus_high.mp3
│       ├── loop_winddown.mp3
│       ├── texture_rain.mp3
│       ├── texture_brown_noise.mp3
│       ├── sfx_lever_grab.mp3
│       ├── sfx_card_materialize.mp3
│       └── sfx_chime_regen.mp3
├── docs/
│   ├── 01-prd.md
│   ├── 02-user-spec.md
│   ├── 03-functional-spec.md
│   └── 04-technical-spec.md
├── .env.local                      # GEMINI_API_KEY, LANGSMITH_API_KEY, etc.
├── package.json
└── README.md                       # async-judge-readable
```

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
│  Next.js page (app/page.tsx)                           │
│    │                                                   │
│    ├── CopilotKit Provider                             │
│    │     └── useCoAgent("hearth")  ← shared state      │
│    │           └── MoodProfile object                  │
│    │                                                   │
│    ├── WelcomeScreen   (F-01)                          │
│    ├── CinematicOpening (F-03)                         │
│    └── Room                                            │
│         ├── Scene (r3f)         (F-04)                 │
│         ├── LeverCard           (F-05/F-06)            │
│         ├── ChatPanel           (F-12)                 │
│         ├── TracePanel          (F-13)                 │
│         └── AudioEngine (singleton, Tone.js) (F-11)    │
│                                                        │
└─────────────────┬─────────────────┬────────────────────┘
                  │ POST            │ stream
                  ▼                 ▼
┌─────────────────── Next.js API ──────────────────────┐
│                                                       │
│  /api/copilotkit/route.ts                             │
│    └── CopilotKit runtime                             │
│         └── Gemini 3.1 Pro adapter                    │
│              ├── system prompt (lib/agents/...)       │
│              ├── frontend-action tool definitions     │
│              └── structured output (Zod-derived)      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Shared state pattern (CopilotKit `useCoAgent`)

The `MoodProfile` is a `useCoAgent` state. Both directions write:

- **User → agent:** lever drag mutates `MoodProfile.<path>`. Agent sees the new state on next dispatch.
- **Agent → user:** agent emits a tool call (`updateMoodProfile`, `regenerateLevers`, `swapScene`); CopilotKit applies it; UI re-renders.

This is the **agentic feedback loop primitive**. It's worth maybe 30 lines of code.

---

## Agent contracts

### F-02 — Goal classification call

**Endpoint:** `/api/copilotkit` (CopilotKit runtime intercepts)

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

**Input:** `{ goal: string }`

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

**MVP simplification:** the demo path uses a hardcoded swap to `WIND_DOWN_PRESET`. Live agent call is gated behind `USE_LIVE_REGEN=true` env flag.

### Frontend actions (registered via `useCopilotAction`)

Three tool calls the agent can make to manipulate the UI directly from chat:

| Tool | Args | Effect |
|---|---|---|
| `updateLeverValue` | `{ leverId: string, value: number \| string }` | Mutates the bound path in MoodProfile |
| `addLever` | `{ lever: Lever }` | Appends to `levers[]`, triggers F-09 partial transition |
| `swapScene` | `{ sceneId: SceneId }` | Mutates `visual.sceneId`, triggers F-10 morph |

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

Implementation: Framer Motion `useAnimationControls` driving:
- One uniform tween chain (8 stops over 8s) for the shader
- One opacity timeline for the goal text
- Audio gain ramps via `Tone.Player.volume.rampTo`

A single `<TransitionDirector>` component owns the timeline. Component unmounts at t=8s, hands off to `<Room>`.

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@copilotkit/react-core": "^2.0.0",
    "@copilotkit/react-ui": "^2.0.0",
    "@copilotkit/runtime": "^2.0.0",
    "@google/genai": "^1.0.0",
    "three": "^0.165.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "tone": "^15.0.0",
    "framer-motion": "^11.0.0",
    "zod": "^3.23.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^4.0.0"
  },
  "stretchDependencies": {
    "@google-cloud/aiplatform": "^3.0.0",
    "@langchain/langgraph": "^0.2.0",
    "langsmith": "^0.2.0"
  }
}
```

Pin all versions; do not upgrade mid-build.

---

## Environment variables

```
GEMINI_API_KEY=...                # required, MVP
NEXT_PUBLIC_COPILOTKIT_LICENSE=...  # from `npx copilotkit@latest license`
LANGSMITH_API_KEY=...             # stretch — for trace
GOOGLE_PROJECT_ID=...             # stretch — for Vertex AI Lyria
USE_LIVE_REGEN=false              # gate for F-08 live agent vs hardcoded
USE_LYRIA=false                   # gate for F-16
USE_LANGGRAPH=false               # gate for F-19
```

---

## Build and run

```bash
# install
npm install

# dev (http://localhost:3000)
npm run dev

# production build (test before demo)
npm run build && npm start
```

Run a production build at 4:00 PM as a smoke test before the 5:00 PM record.

---

## Deployment

For demo: **localhost is fine.** No Vercel deploy required. The submission is the GitHub repo + video.

If we want a live URL post-hackathon:
- Vercel deploy of the Next.js app
- Backend API runs as Vercel Edge Function
- Audio assets served from Vercel static (sub-1MB total)

---

## Implementation order (locked)

| # | Step | Time | Maps to |
|---|---|---|---|
| 1 | Scaffold from CopilotKit GenUI Template | 0.5h | infra |
| 2 | Add deps: Tailwind 4, r3f, Tone, Framer Motion | 0.25h | infra |
| 3 | Drop in audio assets (Suno-generated upfront) | 0.25h | F-11 |
| 4 | Define `MoodProfile` Zod schema + presets + types | 0.5h | data |
| 5 | Build forest cabin shader + r3f wiring | 1.5h | F-04 |
| 6 | Welcome screen + goal entry | 0.25h | F-01 |
| 7 | Mood Architect agent (Gemini call + structured output) | 0.75h | F-02 |
| 8 | Cinematic opening transition | 1.0h | F-03 |
| 9 | LeverCard + LeverSlider + binding hook | 1.0h | F-05/F-06 |
| 10 | Audio engine class + clip preload + crossfade | 0.5h | F-11 |
| 11 | Out-of-bounds detection + regen trigger | 0.25h | F-07 |
| 12 | Mic-drop transition (lever card + scene morph) | 0.75h | F-08/F-09/F-10 |
| 13 | Chat panel (CopilotKit default styled) | 0.25h | F-12 |
| 14 | Stylized trace panel | 0.25h | F-13 |
| 15 | Goal pill + idle fade + sound design SFX | 0.25h | F-14/F-15 |
| 16 | README v1 (differentiation + sponsor stack) | 0.25h | docs |
| 17 | Smoke test, demo path lock | 0.25h | QA |
| 18 | Polish budget (only opening cinematic) | 1.0h | polish |
| **Total MVP** | | **9.5h** | |

> 9.5h estimate vs 6h actual budget. **Cuts (in order if behind):**
> 1. F-13 trace panel (use static screenshot in README instead) → -0.25h
> 2. F-15 idle fade → -0.25h
> 3. F-14 goal pill (just plain text top-left) → -0.1h
> 4. Polish budget reduced from 1h → 30min → -0.5h
> 5. F-12 chat panel (default CopilotKit styling, no custom) → -0.15h
> 6. Bedroom shader = palette swap of cabin + overlay → -0.5h
>
> Cuts deliver 7.75h target. Still tight; will compress further only if 3 PM hits without F-08 working.

---

## Risks (technical)

| Risk | Mitigation |
|---|---|
| Shader takes > 1.5h to look good | Start with a known-working glslsandbox shader as base; iterate rather than write from scratch |
| Tone.js audio context unlock | Trigger `Tone.start()` on first user click in welcome screen |
| Gemini 3.1 Pro structured output not honoring schema | Use `responseMimeType: "application/json"` + Zod parse + retry-once + fallback preset |
| `useCoAgent` shared state stale during rapid drags | Debounce drag commits at 50ms, commit on release |
| Framer Motion timeline drift | Use `useAnimationControls` with explicit `await` per stop, not declarative variants |

---

## Where the user's hands need to be on the keyboard

Per learning mode — the **two seed presets** (`DEEP_FOCUS_PRESET` and `WIND_DOWN_PRESET` in `lib/agents/presets.ts`) are the most consequential code in the entire codebase. They:

- Shape the *first* lever set the user sees (the one we polish for the demo)
- Define the *second* lever set after the mic-drop regen
- Serve as the fallback when the agent fails
- Are the **only** lever sets that are real for the MVP demo path (the agent's "live" output is shadowed by these in the polish path)

Two design decisions you should make before I write the file:

1. **Which 4–6 levers go in the deep-focus preset?** From candidates: tempo, rain, harmonic density, brown noise, window view, break cadence, drone density, vinyl crackle, stargaze toggle, fog level. Pick 4–6.
2. **Which 4–6 levers go in the wind-down preset, with the rule that they must look *visibly different* from focus?** From candidates: valence, pad density, candlelight, breathing pace, ambient warmth, lyric whisper, rain, fog. Pick 4–6.

When we start coding, I'll prepare `lib/agents/presets.ts` with full type-safe scaffolding — header comments, imports, surrounding context — and a clearly-marked `// TODO: pick 4–6 levers` block in each preset for you to fill. **5–10 lines of code each, but they shape every demo screenshot.**

---

## Acceptance criteria for technical spec

- [ ] User confirms stack and version locks
- [ ] User confirms file layout
- [ ] User confirms `MoodProfile` schema (or proposes schema changes)
- [ ] User confirms implementation order
- [ ] User picks 4–6 levers per preset (above)

Once approved, **code begins.**
