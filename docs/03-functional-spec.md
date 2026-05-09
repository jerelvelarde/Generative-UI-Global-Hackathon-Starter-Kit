# Hearth — Functional Spec

**Status:** Draft v0.1
**Date:** 2026-05-09
**Derives from:** `02-user-spec.md`

This spec defines **what each feature does** — triggers, behaviors, edge cases, acceptance criteria. It is the contract between user spec and tech spec.

Every feature has an ID (`F-XX`) for cross-referencing in the technical spec and code comments.

---

## Feature inventory

| ID | Feature | MVP? |
|---|---|---|
| F-01 | Welcome screen + goal entry | ✅ |
| F-02 | Goal classification (agent → MoodProfile) | ✅ |
| F-03 | Cinematic opening transition | ✅ |
| F-04 | Scene renderer (WebGL, parameterized) | ✅ |
| F-05 | Lever Card renderer (from MoodProfile.levers) | ✅ |
| F-06 | Lever ↔ MoodProfile binding (live) | ✅ |
| F-07 | Out-of-bounds detection + regen trigger | ✅ |
| F-08 | MoodProfile regeneration (mic drop) | ✅ |
| F-09 | Lever Card transition animation | ✅ |
| F-10 | Scene morph (cabin → bedroom) | ✅ |
| F-11 | Audio engine (pre-baked crossfade) | ✅ |
| F-12 | Chat surface (CopilotKit) | ✅ |
| F-13 | LangSmith trace panel | ✅ |
| F-14 | Goal pill (top-left status) | ✅ |
| F-15 | Idle UI fade | ✅ |
| F-16 | Lyria 2 live music generation | 🟡 stretch |
| F-17 | Imagen 4 parallax stills | 🟡 stretch |
| F-18 | Reference image upload (multimodal) | 🟡 stretch |
| F-19 | LangGraph multi-agent (real, not single-call) | 🟡 stretch |
| F-20 | Spotify MCP save | ❌ cut |

---

## F-01 — Welcome screen + goal entry

**Trigger:** App load, no `MoodProfile` in state.

**Behavior:**
- Render full-screen welcome: question text + input field + ghosted hint
- Input accepts free-text, no validation other than non-empty
- "Begin" affordance appears when text length > 10 chars
- Hitting Enter (or clicking Begin) submits goal, transitions to F-02

**Edge cases:**
- Empty submission: ignore, no error
- Submission < 10 chars: agent still classifies but adds a chat note: *"I'll work with what I have. The more specific you are, the better."*
- Submission > 500 chars: truncate at 500 with no warning (the agent reads up to 500)
- Resubmission (re-mount): existing `MoodProfile` skips welcome, goes to room

**Acceptance:** A judge with no instructions can land here, type something, and reach the room.

---

## F-02 — Goal classification

**Trigger:** Goal submitted from F-01.

**Behavior:**
- Single Gemini 3.1 Pro call with structured output (Pydantic/Zod schema = `MoodProfile`)
- Input: free-text goal + system prompt (defines the four `goal.kind` enum values, the lever vocabulary, the scene options)
- Output: full `MoodProfile` including `goal.kind`, `music`, `visual`, `levers[]`, `evolution`
- Streaming: not required for MVP (response < 3s)
- Display: while waiting, F-03 cinematic transition plays — covers latency

**Schema validation:**
- If output fails schema, retry once with same prompt
- If retry fails, fall back to hardcoded `deep_focus` preset profile (logged but not user-visible)

**Edge cases:**
- Goal is non-English: pass through; Gemini handles
- Goal is gibberish: agent classifies as `deep_focus` (default)
- Goal is harmful/off-policy (e.g., "help me focus on hacking"): Gemini's safety filter triggers; we catch the block and use default preset + show a soft chat message
- API timeout > 15s: fall back to preset, log the failure

**Acceptance:** For 5 distinct test goals (deep coding, creative writing, studying, working out, winding down), the classifier returns a sensible `goal.kind` + lever set ≥ 4/5 times.

---

## F-03 — Cinematic opening transition

**Trigger:** Goal submitted; runs in parallel with F-02.

**Behavior:**
- Total duration: **exactly 8 seconds**
- Frame-by-frame from user spec (Beat 3) implemented as a Framer Motion timeline
- Single shader is rendered throughout — uniforms tween from "void" preset to scene's initial preset
- Audio: silence → soft rain (3s in) → lo-fi loop fade-in (5s in)
- Goal text dims, lifts, blurs in first 1s; reappears as goal pill (F-14) at 7s mark

**Coordination with F-02:**
- If F-02 completes before 8s: hold the transition; do not skip ahead
- If F-02 still pending at 8s: extend the transition with subtle particle motion until F-02 returns; cap at 15s total then fall back to preset

**Edge cases:**
- WebGL not supported: detect early, show a static gradient + "your browser doesn't support the room" message
- Audio context not unlocked (Safari): the audio fade-in is silent until user interaction; visual transition still plays
- Tab backgrounded mid-transition: transition pauses; resumes on focus

**Acceptance:** A first-time viewer says some version of "whoa" within the 8s window in informal user testing (n=3 minimum).

---

## F-04 — Scene renderer

**Trigger:** `MoodProfile.visual.sceneId` is set.

**Behavior:**
- Two scenes for MVP: `forest_cabin`, `warm_bedroom`
- Each scene = one fragment shader file + a small set of `uniforms`
- Uniforms (all 0–1 unless noted):
  - `uColorTempK` (2700–6500)
  - `uRainIntensity`
  - `uFogDensity`
  - `uWindowGlow`
  - `uTimeOfDay`
  - `uMotionRate`
  - `uVignette`
- Renderer subscribes to `MoodProfile.visual.uniforms`; on change, tweens uniform via `lerp` per frame (~150ms convergence)
- Scene-specific overlays (e.g., bed in bedroom, desk in cabin) are crossfaded image elements above the shader

**Edge cases:**
- Uniform out-of-range: clamp to declared range (no crashes)
- Scene swap mid-transition: in-flight tweens re-target to new scene's preset
- 60fps not achievable on slow GPU: shader has a `LOW_QUALITY` define; pixel ratio drops to 0.5 if FPS < 30 for 2s

**Acceptance:** Dragging any uniform-bound lever is reflected on screen within 200ms.

---

## F-05 — Lever Card renderer

**Trigger:** `MoodProfile.levers` updates.

**Behavior:**
- Renders a card on the right of the canvas
- Each lever in the array is rendered as one of 3 control kinds: `slider`, `segmented`, `toggle`
- Lever metadata used: `id`, `label`, `kind`, `range` ({min, max, default}), `outOfBoundsAt` ({lo?, hi?}), `bindTo` (path string), `description` (optional, shown on hover)
- Levers stagger in (80ms apart) on initial mount or after regeneration
- Card header shows the agent's contextual title (e.g., *"For deep focus debugging"*) and a 1-sentence note from the Mood Architect
- Card collapses to an edge tab after 30s of no interaction; tap to re-expand

**Edge cases:**
- `levers.length === 0`: render an empty card with a "regenerating…" spinner
- Lever metadata invalid: log warning, skip rendering that lever (no crash)
- > 8 levers: card scrolls vertically; staggered animation caps at 8 visible at once

**Acceptance:** A judge can read every lever label and intuit what it controls without explanation.

---

## F-06 — Lever ↔ MoodProfile binding

**Trigger:** User interacts with a lever.

**Behavior:**
- Each lever declares a `bindTo` path (e.g., `"music.bpm"`, `"visual.uniforms.rainIntensity"`)
- On drag, `MoodProfile` is mutated at that path (debounced at 50ms during drag, committed on release)
- `MoodProfile` is shared state via CopilotKit's `useCoAgent` — frontend writes are visible to backend agent
- Audio engine (F-11) and scene renderer (F-04) subscribe to relevant paths and react

**Edge cases:**
- Two levers binding to the same path: last write wins
- Invalid path (typo in agent output): log + skip the binding (lever still drags, nothing happens)
- Concurrent agent write during user drag: user write wins until release; agent write applies on next idle tick

**Acceptance:** A drag of any slider produces audio + visual change with no perceived lag.

---

## F-07 — Out-of-bounds detection

**Trigger:** Any lever value crosses `outOfBoundsAt.lo` or `outOfBoundsAt.hi`.

**Behavior:**
- Lever color shifts amber over 200ms
- Tooltip appears: *"This is below/above your declared focus range. Keep going to switch modes."*
- A 3-second timer starts
- If user returns within range: timer cancels, lever color reverts
- If user holds out-of-bounds for 3s OR drags further out: F-08 fires

**Edge cases:**
- Lever with no `outOfBoundsAt`: never triggers F-08 (skip detection)
- User drags wildly across the threshold multiple times: each cross resets the timer; F-08 fires only on a sustained 3s hold
- F-08 already in progress: ignore further triggers

**Acceptance:** The amber state is visually unmistakable; the regeneration fires reliably on demo path.

---

## F-08 — MoodProfile regeneration (mic drop)

**Trigger:** F-07 fires.

**Behavior:**
- Side panel streams agent reasoning: *"Mood Architect: detecting energy drop. Reclassifying as wind-down session."*
- Chime sound plays
- A new Gemini 3.1 Pro call is made with: original goal + current MoodProfile + reason (*"user pushed BPM to {value}"*)
- Output: new full `MoodProfile` with different `goal.kind`, `levers[]`, `visual.sceneId`
- F-09 (card transition) and F-10 (scene morph) fire from the new profile

**MVP simplification:**
- For demo reliability, the regeneration path can be a **hardcoded preset swap** (`deep_focus` → `wind_down`) rather than a real agent call. The visible "agent reasoning stream" is real text but pre-scripted.
- A flag `USE_LIVE_REGEN` toggles between hardcoded preset and live Gemini call. Demo runs with hardcoded; stretch tries live.

**Edge cases:**
- Agent call fails: fall back to hardcoded preset, suppress the failure
- Already in `wind_down`: no further regeneration; tooltip changes to *"You're already in wind-down."*

**Acceptance:** Mic-drop moment fires every time on the demo path.

---

## F-09 — Lever Card transition

**Trigger:** F-08 emits a new MoodProfile with different `levers[]`.

**Behavior:**
- Old levers fold out: each lever animates `scaleY: 1 → 0` and `opacity: 1 → 0`, staggered 80ms apart, total 600ms
- Card header crossfades to new title
- New levers unfurl in: each lever `scaleY: 0 → 1` and `opacity: 0 → 1`, staggered 80ms, total 600ms
- Total transition: 1.2s

**Edge cases:**
- New levers identical to old (same IDs): just update values without unfold animation
- User interacts during transition: queue interaction; apply after transition completes

**Acceptance:** The transition reads as "the UI just changed its mind."

---

## F-10 — Scene morph

**Trigger:** F-08 emits a new MoodProfile with different `visual.sceneId`.

**Behavior:**
- All shader uniforms tween from current values to new scene's preset over 3s (`easeInOutCubic`)
- Scene-specific overlay images crossfade simultaneously
- After tween completes, the inactive scene's overlays unmount

**Edge cases:**
- Same scene ID: only uniforms tween (no overlay swap)
- Tween interrupted by another scene change: re-target to newest target

**Acceptance:** Scene morph feels continuous, not a cut.

---

## F-11 — Audio engine

**Trigger:** `MoodProfile.music` mounts or updates.

**Behavior:**
- Pre-loaded clips: `loop_focus_low.mp3`, `loop_focus_mid.mp3`, `loop_focus_high.mp3`, `loop_winddown.mp3`, `texture_rain.mp3`, `texture_brown_noise.mp3`
- Clips loop seamlessly via Tone.js `Player` with `loop: true`
- Crossfade engine:
  - `intensity` (0–1) drives a 3-way crossfade among low/mid/high focus clips (or 1-way for wind-down)
  - `aux.rain` drives volume of `texture_rain` (0 → -∞ dB at 0; 0 dB at 1)
  - `aux.brownNoise` drives volume of `texture_brown_noise` similarly
- All gain changes ramp over 250ms to avoid clicks
- Goal-kind change (focus → winddown): slow 2s crossfade out of focus stack, in to wind-down clip

**Edge cases:**
- Audio context locked (browser autoplay policy): wait for first user interaction; visual works in silence until then
- Clip fails to load: skip that clip; remaining mix continues
- BPM lever drag: BPM value affects choice of clip (low/mid/high) but does NOT actually change clip tempo (no time-stretch in MVP)

**Acceptance:** No audible clicks or pops between any state transition. Crossfades feel musical.

---

## F-12 — Chat surface

**Trigger:** Available from after F-03 completes.

**Behavior:**
- CopilotKit's chat UI, restyled to match Hearth aesthetic
- Default state: collapsed pill at bottom of canvas
- Expand on click → chat panel slides up, ~40% canvas height
- User messages send to backend; agent responds via streaming
- Agent can return either text or tool calls; tool calls render as updates to MoodProfile (which propagate to F-04, F-05, F-11)
- Auto-scrolls but yields to user scroll-back

**Tools available to agent (via `useCopilotAction`):**
- `update_lever_value(leverId, value)` — for chat-driven adjustments
- `add_lever(lever)` — agent can add a new lever via chat (e.g., user says "give me a star intensity control")
- `swap_scene(sceneId)` — agent can change the room
- `regenerate_mood_profile(reason)` — agent can preempt F-07 trigger

**Edge cases:**
- Chat closed when agent message arrives: badge appears on chat pill with unread count
- Agent message takes > 10s: typing indicator shown; no timeout

**Acceptance:** Chat is a true second input (not just a status feed); typing direction changes the world.

---

## F-13 — LangSmith trace panel

**Trigger:** Right-edge tab clicked OR agent dispatches a multi-step plan.

**Behavior:**
- Collapsible tab on far right, opens to ~30% canvas width
- Renders a stylized agent trace: each subagent dispatch shown as a card with name, latency, output preview
- Backed by real LangSmith run data IF F-19 stretch is in; otherwise hardcoded "stylized" trace

**MVP simplification:**
- Show stylized trace events that match the demo arc; data may be hardcoded
- Real LangSmith integration is stretch (F-19)

**Edge cases:**
- LangSmith API down: panel still renders with cached/stylized trace
- No agent activity: panel shows empty state with subtle pulse

**Acceptance:** A judge skimming the panel during the demo recognizes the multi-agent story.

---

## F-14 — Goal pill

**Trigger:** F-03 transition reaches 7s mark; or any time after.

**Behavior:**
- Small mono-text pill in top-left
- Format: `{goal.kind} · {duration} min · {short description}`
- Static (no animation after appearance)
- On click: optional, opens a tiny popover with the full original goal text

**Edge cases:** None significant.

**Acceptance:** Visible but unobtrusive throughout session.

---

## F-15 — Idle UI fade

**Trigger:** No user interaction for 30s.

**Behavior:**
- Lever Card collapses to edge tab (F-05)
- Chat collapses to pill (F-12)
- Trace panel collapses (F-13)
- Goal pill fades to 30% opacity
- Scene continues at full intensity

**Edge cases:**
- Any interaction (mouse move within canvas, keyboard, click): un-fades immediately

**Acceptance:** After 30s idle, the room dominates the screen.

---

## Stretch features (briefly)

### F-16 — Lyria 2 live music generation
Replace pre-baked crossfade with real Lyria 2 calls. On significant `MoodProfile.music` change (debounced 5s), call Lyria with `promptForGen` from profile; cache result; crossfade in. Falls back to pre-baked on failure. 30s clips loop with Tone.js.

### F-17 — Imagen 4 parallax stills
Generate window-view image at scene init (e.g., "view through cabin window of a misty pine forest at dusk, painterly, warm"). Render as parallax layer. Cache by scene+goal hash.

### F-18 — Reference image upload
User drops an image into chat. Gemini 3.1 multimodal reads it; Mood Architect adapts MoodProfile (color temp, motion, vibe) to match.

### F-19 — Real LangGraph multi-agent
Replace single Gemini call (F-02, F-08) with LangGraph state machine: Mood Architect → parallel (Music Producer, Visual Director, Pacing Coach) → Critic → emit MoodProfile. Real LangSmith traces.

---

## Cross-cutting acceptance criteria

- [ ] Demo path runs end-to-end (F-01 → F-08) without manual intervention
- [ ] All MVP features have at least minimal error handling (no white screens)
- [ ] No console errors during demo path
- [ ] All sponsor logos / mentions visible in UI or trace panel: CopilotKit, Gemini, LangGraph, LangSmith
