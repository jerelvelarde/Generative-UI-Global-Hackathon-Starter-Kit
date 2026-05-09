# Hearth — Team Plan (3-person, 6 hours)

**Status:** Draft v0.1
**Date:** 2026-05-09
**Derives from:** `04-technical-spec.md`

This spec defines **who builds what, in which files, in what order**. Three engineers, six hours, one shared schema as the contract.

---

## Roles

| Role | Person | Owns |
|---|---|---|
| **A — Sound & Stage** | (assign) | Frontend UI components, WebGL scenes/shaders, audio engine, motion/transition design, sound design assets |
| **B — Brain** | (assign) | Python LangGraph agent, Gemini 3.1 Pro Preview prompts + structured output, presets, schema authoring (Pydantic side), Lyria/Imagen stretch wiring |
| **C — Wiring** | (assign) | CopilotKit v2 + AG-UI runtime in Hono BFF, frontend-owned MoodProfile store (Zustand), CopilotKit frontend tool registration (`useCopilotAction`), lever ↔ profile binding, regen trigger logic, monorepo dev infra, README. Per F-06: MoodProfile lives client-side; agent mutates it via tool calls, not shared state round-trip. |

These titles are deliberate. Person A makes it **feel** real. Person B makes it **be** intelligent. Person C makes the two **talk**.

---

## File ownership (no overlapping edits)

```
apps/frontend/
├── src/app/page.tsx                    ← C (composition only)
├── src/app/layout.tsx                  ← C
├── src/components/copilot/             ← C (provider, runtime URL, tool registration)
├── src/components/hearth/
│   ├── welcome/                        ← A
│   ├── transition/                     ← A
│   ├── room/                           ← A
│   │   └── shaders/                    ← A
│   ├── lever-card/                     ← A (rendering) + C (binding hook)
│   │   ├── LeverCard.tsx               ← A
│   │   ├── LeverSlider.tsx             ← A
│   │   ├── LeverSegmented.tsx          ← A
│   │   ├── LeverToggle.tsx             ← A
│   │   └── useLeverBinding.ts          ← C
│   ├── chat/                           ← C
│   └── trace/                          ← C
├── src/lib/hearth/
│   ├── schema.ts                       ← B (authors), all 3 (read-only)
│   ├── presets.ts                      ← B
│   ├── audio/                          ← A
│   ├── genui/
│   │   ├── outOfBounds.ts              ← C
│   │   └── regenerate.ts               ← C
│   └── types/                          ← B
└── public/audio/                       ← A (asset drops)

apps/bff/src/server.ts                  ← C
apps/agent/src/                         ← B

docs/                                   ← anyone, but PR with review
README.md                               ← C
```

**Rule:** never edit a file outside your column without paging the owner. Exceptions only for typo fixes.

---

## The contract — locked at minute 20

The single artifact all three tracks depend on:

`apps/frontend/src/lib/hearth/schema.ts` (Zod) **and**
`apps/agent/src/hearth/schema.py` (Pydantic — mirrors the Zod schema exactly)

Person B owns both files. Person B's **first deliverable (by minute 20)** is:
- Both schema files committed
- A sample valid `MoodProfile` JSON committed in `docs/samples/sample-mood-profile.json` for A and C to mock against
- A short Slack/Discord message: *"Schema locked at hash $X. Mock JSON at /docs/samples/. Go."*

Once this lands, **A and C unblock and sprint**. They never have to wait for Person B's prompt work to finish.

If schema needs to change after minute 20 (it will), Person B announces every change in the team channel and bumps the file with a comment.

---

## Hour-by-hour plan

### Hour 0 (12:30 PT) — Kickoff video, no code yet

All 3 watch the kickoff. Skim, don't memorize.

### Hour 1 (1:00–2:00 PT) — Setup + schema lock

| Time | A | B | C |
|---|---|---|---|
| 1:00 | Pull repo, install deps, dev runs | Pull repo, install deps, dev runs | Pull repo, install deps, dev runs |
| 1:10 | Generate audio assets via Suno (4 loops + 2 textures) — write prompts in advance | Author Zod + Pydantic schemas, commit sample JSON | Verify monorepo dev script runs (frontend + bff + agent), commit env.example |
| 1:20 | Drop SFX into `/public/audio/` | **Schema locked** ✓ | CopilotKitProvider points at BFF, "hello world" message proves the pipe |
| 1:30 | Welcome screen UI (F-01) — static layout + input | Mood Architect prompt v1 (deep_focus only) | Zustand `hearthStore` initialized with `SAMPLE_MOOD_PROFILE`; CopilotKit frontend tools `updateLeverValue`/`addLever`/`swapScene` registered (no-op handlers OK) |
| 1:50 | Welcome screen ships — visual idle | Returns sample JSON for any goal text | Frontend reads `hearthStore.profile.goal.description` and renders it; trigger BFF call on goal submit |

**End-of-hour checkpoint at 2:00 PT:**
- Schema locked, sample JSON in repo
- Welcome screen renders, user can type a goal
- Goal text round-trips to BFF and back (even with a hardcoded response)
- Audio assets in `/public/audio/`

If this checkpoint slips, **cut chat panel and trace panel from MVP**.

### Hour 2 (2:00–3:00 PT) — Independent build

| A | B | C |
|---|---|---|
| Forest cabin shader v0 (gradient + window glow), wired to r3f | Mood Architect returns *real* `MoodProfile` for free-text goal (deep_focus only) | LeverCard renders any `MoodProfile.levers[]` from sample JSON |
| AudioEngine class — preload clips, gain ramps work | `DEEP_FOCUS_PRESET` + `WIND_DOWN_PRESET` shipped as Pydantic constants | `useLeverBinding` hook — slider drag mutates MoodProfile path |
| Lever component visuals (slider, segmented, toggle) — pure presentational | Schema validation + retry logic + preset fallback | Out-of-bounds detection (F-07) — debounced timer, amber state |

**Checkpoint at 3:00 PT:**
- A: Scene renders with hardcoded uniforms; lever components render from sample JSON.
- B: Real Gemini call returns valid MoodProfile for "debugging concurrency for 90 minutes."
- C: User can drag a slider and the bound path in MoodProfile updates (logged to console).

### Hour 3 (3:00–4:00 PT) — Integration push

This is where 80% of teams fall apart. The plan is **everyone joins integration**.

| Time | All three |
|---|---|
| 3:00 | A + C pair on lever-to-shader live binding (drag rain → window rain visibly intensifies) |
| 3:15 | B + C pair on regen trigger — F-07 fires F-08, agent returns wind-down profile |
| 3:30 | A connects audio engine to MoodProfile.music — clips crossfade on profile change |
| 3:45 | First end-to-end run: welcome → goal → scene → lever drag → regen → bedroom scene |

**Checkpoint at 4:00 PT — DEMO PATH SMOKE TEST.** If end-to-end doesn't run by 4:00, stop adding features and start cutting.

### Hour 4 (4:00–4:30 PT) — Polish + cinematic transition

| A | B | C |
|---|---|---|
| Cinematic opening (F-03) — the polish-budget hero. 8s Motion timeline. | Critic step (validation + safety) | Trace panel (F-13) — stylized data |
| Scene morph (F-10) | Stretch: real Lyria 3 Clip Preview call | Chat panel styling + first message handling |
| Sound design SFX wiring | | Goal pill (F-14), idle fade (F-15) |

**Code freeze on demo path at 4:30 PT.** No new features after this. Only bug fixes on the recorded path.

### Hour 5 (5:00 PT) — Record demo video (firm)

C runs the demo on screen, A monitors audio levels, B captures backend trace screenshots if real LangSmith is wired.

Re-record only if materially better.

### Hour 5.5 (5:30–5:55 PT) — README + submission

| A | B | C |
|---|---|---|
| Take 4 hero screenshots for README | Document agent prompts + sample inputs/outputs | Write README, push to GitHub, fill submission portal |

**6:00 PT — submitted.**

---

## Communication protocol

- **Channel:** one shared Discord/Slack room, voice + text both open
- **Status pings:** every 30 minutes, each person posts one line — *"on track / blocked on X / cut Y."*
- **Schema changes:** Person B pings when changing schema. A and C ack before continuing.
- **Blocking moments:** if any person is blocked > 10 minutes, page the team. Don't suffer alone.
- **Demo path lock at 4:30:** no merges to main without both other people's ack.

---

## First-30-minute deliverables (sets the tone for the whole day)

These prove the pipes are wired. Do these *first*, before opening the feature work.

### Person A's first 30
- Repo cloned, frontend dev runs at localhost:3010
- A blank `WelcomeScreen.tsx` renders the question text + a stub input
- Suno-generated `loop_focus_low.mp3` exists at `/public/audio/`
- Imports `motion` from `motion/react`, can animate a div on mount

### Person B's first 30
- Repo cloned, agent dev runs (Python process up)
- `schema.ts` and `schema.py` committed and mirror each other exactly (a tiny round-trip script verifies this)
- `docs/samples/sample-mood-profile.json` committed
- Slack message: *"schema locked, go."*

### Person C's first 30
- Repo cloned, monorepo dev script `npm run dev` boots all three services
- BFF returns a hardcoded MoodProfile when the frontend asks
- `useCoAgent("hearth")` initialized with `initialState: SAMPLE_MOOD_PROFILE`
- Slack message: *"BFF + frontend wired, hearthState reads sample JSON."*

If all three of these land by 1:30 PT, you ship.

---

## Cuts (in order, if behind schedule)

If 3:00 PT checkpoint isn't met, cut from this list, in order:

1. **F-13 trace panel** → static screenshot in README
2. **F-15 idle fade** → don't ship
3. **F-12 chat panel** → ship CopilotKit default, no styling
4. **F-14 goal pill** → plain text top-left
5. **Bedroom scene custom shader** → palette swap of cabin shader
6. **All stretch features** (F-16, F-17, F-18, F-19) → don't even start
7. **Cinematic transition** reduced from 8s to 4s

If 4:00 PT integration smoke test fails, cut one of:
- **F-08 live regen agent** → hardcoded preset swap is fine; nobody will know
- **F-07 amber-state UX** → just trigger F-08 immediately on threshold cross

---

## Risk register (team-specific)

| Risk | Mitigation |
|---|---|
| Person B's Gemini structured output is flaky | Schema validation + 1 retry + preset fallback. B never blocks A or C — they always have sample JSON. |
| Person A's shader takes too long to look good | Ship "v0 = colored gradient + glowing rectangle window" by 2:00, iterate to v1 by 3:30. Polish only after demo path locks. |
| Person C's CopilotKit AG-UI integration breaks | Pin versions on minute 1. If broken, fall back to plain HTTP fetch from frontend → BFF; lose sponsor visibility but keep demo. |
| Two people editing the same file | File-ownership table above. Treat the column as a hard boundary. |
| Schema drift between TS and Python | A round-trip test runs in CI on every commit (`npm run test:schema`). |
| One person absent (sick, late) | Their tracks are mostly independent of each other. C is the most centrally connected; if C is out, A and B can pair to absorb the wiring. |

---

## What "done" looks like at 5:30 PT

- [ ] User goes from black screen to working Hearth in one path
- [ ] Lever drag visibly + audibly changes the world
- [ ] Mic-drop regeneration fires reliably
- [ ] Scene morphs from cabin to bedroom
- [ ] At least 2 sponsor logos visible in the UI
- [ ] README explains what was built and why
- [ ] Demo video < 3 minutes, recorded and uploaded
- [ ] Public GitHub repo with the build

If 7/8 boxes are checked, you ship and you're proud.
