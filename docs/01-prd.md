# Hearth — Product Requirements Document

**Status:** Draft v0.1
**Date:** 2026-05-09
**Event:** AI Tinkerers SF — Generative UI Global Hackathon
**Submission deadline:** 6 PM PT
**Author:** pratikm@aibor.io

---

## TL;DR

Hearth is a **conversational, generative mood studio for focus work**. The user describes what they're working on; an agent ensemble synthesizes a personalized "room" — original music, an ambient WebGL scene, and a *goal-specific control surface* — that the user can steer in real time. The control surface itself is generated per goal: a deep coding session gets different levers than a creative writing session, and the agent rewrites the lever set when the user's adjustments imply a new mood. **The UI is the agent's output.**

One-line pitch: *"claude-music finds you a station. Hearth builds you a room."*

---

## Problem

Knowledge workers reach for ambient audio (lo-fi girl, brain.fm, Endel, Spotify focus playlists) to manage attention during deep work. Every existing solution is one of two shapes:

1. **Static curation** — pre-recorded playlists or radio streams. Same audio for "deep coding" as for "writing your wedding toast."
2. **Genre-tagged generation** — pick a genre, get a feed. The user has no fine control and no awareness of *why* the system picked what it did.

Neither responds to the **specific** context of *what* you're working on, *how long* you have, or *what kind* of attention the task demands. The control surfaces are generic because they were drawn by a designer in advance.

---

## Target user

Primary: **Self-directed knowledge workers** (developers, writers, designers, researchers, students) who already use ambient audio for focus and would value a system that adapts to their specific session.

The hackathon judging audience overlaps almost entirely with this profile, which is intentional.

---

## Goals (in priority order)

1. **Pass the FIGMA TEST.** Every screen the user sees must be impossible for a designer to have drawn upfront — its content is a function of the user's stated goal.
2. **Demonstrate a clean agentic feedback loop.** User adjusts a lever → agent regenerates state → UI reflects the regeneration → user adjusts again. Visible, smooth, repeatable.
3. **Show the affordance set itself regenerating.** When the user's behavior implies a different mood, the lever set is replaced with a new one (different controls, not just different values).
4. **Multi-sensory wow.** Audio + visuals + control all responding to a single conversational signal.
5. **Use the hackathon stack visibly and coherently.** CopilotKit/AG-UI (runtime UI), Gemini 3.1 Pro Preview (agent), LangGraph (agent runtime), LangSmith (trace/story panel), and Google media models only where they improve the demo without risking the 6-hour build.

## Non-goals

- Full DAW capability, mixing, mastering, stem editing
- Spotify-killer scale of music library
- Video generation (Veo) — explicitly skipped for MVP
- Mobile / responsive design — desktop only for the demo
- Multi-user sessions, social features, accounts, auth
- Production music quality — demo-grade is fine
- Latency optimization for streaming inference (handbook trap)

## Success metrics

Hackathon-specific. There is one user (the judge), one session (the demo).

| Metric | Target |
|---|---|
| Demo viewer reaches "wow" moment | < 30 seconds from first frame |
| Distinct GenUI surfaces shown | ≥ 3 (lever card, regenerated lever card, scene morph) |
| Sponsor logos legible in demo or README | ≥ 4 (CopilotKit, Gemini, LangGraph, LangSmith) |
| README readable by an async judge in | ≤ 90 seconds |
| Live demo works on first attempt | Yes (pre-baked path) |

---

## Solution overview

A web app with three surfaces, all driven by a shared `MoodProfile` state object that both the user and the agent ensemble write to:

1. **The Room** (full-screen WebGL scene). Parameterized shader that responds to mood profile uniforms — color temperature, rain intensity, fog, motion rate, time-of-day, vignette. Two scene templates for MVP: **forest cabin** (deep focus) and **warm bedroom** (wind-down). Audio plays underneath: pre-baked loops crossfaded with rain/noise textures. Live Lyria generation is stretch only.

2. **The Lever Card** (right side). The agent's emitted control surface for *this* user, *this* goal, *this* moment. Each lever binds to either a music parameter (BPM, intensity, valence) or a visual parameter (rain, color temp, motion). The set of levers is **selected by the agent** — not hardcoded. Pushing a lever past its declared "valid range for this goal" triggers a regeneration: the card animates out and a new card with a different set replaces it.

3. **The Conversation** (left side, collapsible). A CopilotKit chat surface where the user can type free-form direction ("less melodic, more drone") and observe visible state changes. Reference-image upload is stretch only.

**The agent story** (LangGraph + CopilotKit):

- **Mood Architect** (Gemini 3.1 Pro Preview, thinking enabled) — root planner. Reads the goal, writes the `MoodProfile`, decides the lever set.
- **Music Producer** (MVP: pre-baked loops; stretch: Lyria 3 Clip Preview or Lyria 2 if credits only cover Vertex) — generates or selects 30s music clips matched to the profile.
- **Visual Director** (MVP: shader uniform writer; stretch: Imagen 4 Fast / Nano Banana preview if available) — sets visual parameters.
- **Critic** (MVP: schema validation + fallback preset; stretch: Gemini Flash validator) — validates that the generated package matches the goal before the user sees it.

LangSmith trace visibility is a demo requirement, but real trace ingestion is stretch. The MVP may show a truthful stylized trace of the exact state transitions if live LangSmith wiring would endanger the demo.

---

## Differentiation

| | claude-music (reference) | Brain.fm / Endel | **Hearth** |
|---|---|---|---|
| Surface | Terminal CLI | Mobile app | Web, full-screen ambient |
| Music | Pre-existing radio | Curated procedural | **Selected/generated per goal** |
| Visuals | None | Static gradients | **Live WebGL scene** |
| Control surface | Static slash commands | Fixed sliders | **GenUI — generated per goal** |
| Affordance regeneration | None | None | **Yes — set changes mid-session** |
| Agentic feedback loop | None | None | **Yes — user ↔ agent shared state** |

---

## Scope — MVP (must ship by 5 PM)

1. Single happy-path flow: welcome → goal entry → cinematic transition → cabin scene + lever card → live lever response → mic-drop regeneration into bedroom scene
2. **One** fully polished scene: forest cabin (with rain, fog, window glow, color temp uniforms wired)
3. **One** alternate scene for regeneration: warm bedroom (less polish OK)
4. **One** lever card template for "deep focus" goal (4–6 levers)
5. **One** alternate lever card for "wind-down" (4–6 levers, different ones)
6. Pre-baked audio: 4 short loops (low/mid/high focus + wind-down) + rain/noise textures, crossfaded by Tone.js
7. Mood Architect agent with structured `gemini-3.1-pro-preview` output → emits `MoodProfile`
8. Hardcoded threshold rule for triggering regeneration (no real reasoning required for MVP)
9. README with differentiation pitch, transparent build notes, sponsor stack, and demo GIF/video

## Stretch (in only if 5 PM hits with polish budget left)

- **Real-time Lyria generation** — use `lyria-3-clip-preview` for short clips if Gemini API access is enabled; otherwise use Vertex `lyria-002` / Lyria 2. Keep pre-baked audio as fallback.
- **Imagen / Nano Banana parallax stills** — agent generates a window-view image based on user's stated environment preference
- **Reference image upload** — user drops a mood photo, Mood Architect reads via Gemini 3.1 multimodal in
- **LangGraph multi-agent (real, not single-call)** — visible LangSmith trace in side panel
- **MCP Apps / A2UI surface** — only if the core room works early; not required for the winning moment

## Out of scope (don't even joke about it)

- Stem separation
- Full DAW
- Veo video generation
- User accounts
- Mobile
- Production deployment
- Latency optimization (THE TRAP)

---

## Constraints

| Constraint | Implication |
|---|---|
| 6h total build, 1 person | Brutally tight scope. Every feature pre-justified by demo arc. |
| 5 PM video record | Code freeze on demo path at 4:30 PM. |
| Public GitHub | README is part of the submission. Write from hour 1. |
| Async judging weight | Demo video + README must stand alone. |
| Sponsor stack must be visible | At least 3 logos in demo, all in README. |
| Pre-existing code is allowed but judged | Be transparent about starter-kit usage and what was built during the six focused hours. |

---

## Locked decisions (resolved 2026-05-09)

1. **Goal entry: pure free-text.** Agent infers goal kind. Reasoning: most impressive GenUI demonstration — the *classification itself* is agent work. Mitigation: schema-validate the goal kind output; fall back to "deep_focus" preset on parse failure.
2. **Chat surface: persistent collapsible chat in MVP.** CopilotKit's chat is always available; user can type free-form direction mid-session. Reasoning: sponsor visibility + supports the agentic feedback loop continuously, not just at start.
3. **Audio: pre-baked for MVP, Lyria in stretch.** 4 pre-generated loops crossfade via Tone.js. Live generation runs in background as stretch — swap in if working, retain pre-baked as fallback.
4. **Trace panel: ship as a truthful stylized MVP.** If live LangSmith setup is ready, wire it. If not, show the state transitions and mention LangSmith in README as stretch/next step.
5. **Spotify integration: cut entirely.** OAuth complexity not worth it for a 6h demo. Re-evaluate only if everything else ships by 4 PM.

## Locked anchors

- **Demo anchor goal:** "Deep coding / debugging focus" — judge-relatable, fits the forest-cabin scene aesthetically.
- **Polish budget:** opening cinematic transition (Goal → Scene materialize). Other moves work but aren't film-quality.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shader scenes take longer than 1.5h to look good | Med | High | Use a known-good `r3f` boilerplate; only one scene polished |
| Gemini structured output flaky | Low | High | Use `gemini-3.1-pro-preview`; schema-validate; retry once; fall back to hardcoded preset on failure |
| Lyria access blocked or slow (stretch) | Med | Low | Pre-baked audio is the MVP; Lyria is optional sponsor credit |
| CopilotKit GenUI template breaking changes | Low | High | Pin versions early; don't upgrade mid-build |
| Tone.js crossfades click/pop on transition | Med | Med | Use `Tone.CrossFade` with EQ-matched tails; test early |
| Demo recording fails at 5:00 PM | Low | Catastrophic | Record at 4:45 PM as well; keep the better take |

---

## Approvals / sign-off

- [ ] User confirms target user profile
- [ ] User confirms primary goal kind ("deep coding focus" as the demo anchor)
- [ ] User confirms scope (MVP / stretch / out-of-scope buckets)
- [ ] User confirms sponsor stack priority order

Once approved, this PRD is **frozen**. Any change to scope after this point requires explicit re-approval.
