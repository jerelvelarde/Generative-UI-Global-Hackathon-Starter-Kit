# Hearth — User Spec

**Status:** Draft v0.1
**Date:** 2026-05-09
**Derives from:** `01-prd.md`

This spec describes **what the user does**, beat by beat. It does not describe what the system does internally (functional spec) or how it's built (technical spec). Read this and you should understand the demo.

---

## Persona — "Maya"

- 28, senior backend engineer at a mid-size company
- Works from home, 3-hour deep-work blocks most days
- Reaches for Spotify focus playlists, Brain.fm, sometimes lo-fi girl on YouTube
- Frustration: "Same playlist for debugging concurrency bugs as for writing my mom a birthday card. It doesn't *care* what I'm doing."
- Quote we want her to say in the demo: *"It built me a room."*

(Maya is a stand-in for the hackathon judges. The persona exists to keep us honest — we are not building for "users in general." We are building for one Maya in one moment.)

---

## Emotional arc

The demo is a 90-second story:

| Beat | Maya feels | UI mirror |
|---|---|---|
| 1. Open app | Curious, slightly skeptical | Minimal welcome, single input. No clutter to dismiss her. |
| 2. Type goal | Vulnerable (telling a system what she's doing) | Input field grows in importance, takes its time |
| 3. Transition | Surprised by the production value | 8-second cinematic — earned attention |
| 4. Scene reveal | "Oh." | Room exists. Audio plays. Her goal text now small, top-left. |
| 5. Lever discovery | "Wait, these are *for me*?" | Levers labeled in plain language, not jargon |
| 6. Lever drag | Playful, in control | World responds visibly + audibly |
| 7. Mic-drop regen | "It noticed?" | Card unfurls out, new card unfurls in, scene morphs |
| 8. Trust earned | Settles in, forgets the demo, starts working | Subtle UI fades back; the room takes over |

The arc is **skepticism → surprise → play → trust**. Every interaction either earns a step or wastes one.

---

## Primary user journey — beat by beat

### Beat 1 — Welcome (0:00–0:05)

**State:** App open, fresh session.

**What Maya sees:**
- Deep midnight blue full-screen
- One line of soft serif text: *"What are you working on?"*
- One input field, centered, generous breathing room
- No nav, no logo, no menu. Just the question.
- A subtle cursor pulse in the input

**What Maya does:** Reads the question. Pauses. Decides to be honest with the input.

**Why it matters:** We get one shot at "this is not another chatbot." The welcome screen is *the brand promise*. No nav = "this app exists for one purpose." No suggestions = "we want to hear *you*."

---

### Beat 2 — Goal entry (0:05–0:13)

**State:** Maya is typing.

**What Maya sees:**
- Her text appears in the input as she types
- Below the input: tiny ghosted hint text fades in: *"the more specific, the better the room"*
- No autocomplete, no suggestions, no validation jankPlaceholder
- A "begin" affordance appears subtly when she's typed > 10 chars (or pressed Enter)

**What Maya types:** *"Debugging a flaky integration test, need 90 minutes of deep focus."*

**What Maya does:** Hits Enter (or clicks the affordance).

**Why it matters:** Free-text, not a chip-picker. Every word she writes increases the agent's signal. The "specificity rewarded" hint *educates* her about how the agent works without being a tutorial.

---

### Beat 3 — Cinematic transition (0:13–0:21)

**The polish-budget hero moment.** 8 seconds. Maya does nothing. We earn her attention.

**What Maya sees:**
- Her text dims to 30%, lifts upward, blurs gently
- A small caption fades in below: *"Mood Architect engaged"* in 8pt mono — agency credit, like a film opening
- An ambient particle field begins drifting — slow, warm
- A distant warm point of light appears (the cabin window, far away, out of focus)
- Camera dolly forward across parallax particle layers
- The light grows, takes shape, becomes a window
- Audio: soft rain begins quietly first, then a lo-fi loop fades in under it
- Camera dolly settles. Her goal text re-emerges, smaller, top-left, in mono: *"deep focus · 90 min · debugging"*

**What Maya does:** Watches. Maybe leans in.

**Why it matters:** This is the *only* moment in the demo we explicitly engineer for "wow." The 8-second budget is non-negotiable: shorter feels rushed, longer feels indulgent. Film editors call this an "establishing shot" — we're establishing both the world and the system's intent.

---

### Beat 4 — Lever Card materializes (0:21–0:30)

**State:** Scene is fully present. Maya is looking around.

**What Maya sees:**
- Card unfurls on the right side, glassmorphic, half-transparent over the scene
- Header: *"For deep focus debugging"* + a tiny goal-icon
- Levers stagger in from top to bottom with spring physics:
  1. **Tempo** — slider, 60–72 BPM, default 65
  2. **Rain** — slider, none → thunderstorm
  3. **Harmonic density** — slider, drone → jazzy
  4. **Brown noise** — slider, off → heavy
  5. **Window view** — segmented control, [forest / city / cabin / ocean]
  6. **Break cadence** — segmented control, [none / 50–10 / 25–5]
- A small "Mood Architect's notes" line above the levers in italic serif: *"Calibrated for sustained attention. Lower the tempo if you're debugging logic; raise it for refactoring rhythm."*

**What Maya does:** Reads the labels. Realizes these aren't generic — they describe *her work*.

**Why it matters:** Plain-language lever labels (not "low-pass filter cutoff") is what makes the GenUI feel personal. The Architect's note tells Maya there's a *reasoning* behind the choice — without showing a wall of trace.

---

### Beat 5 — Lever play (0:30–0:55)

**State:** Maya is exploring.

**What Maya does (in order):**
1. Drags **Rain** up to ~80% — window rain visibly intensifies, audio rain crossfades up
2. Drags **Harmonic density** down to drone — music shifts to a sparser pad-heavy layer
3. Tries **Window view** — clicks "ocean," scene cross-dissolves to a coastal cabin variant (stretch — for MVP, only "forest" works; clicking others shows a "preview only in Pro" tooltip OR is hidden)
4. Drags **Tempo** way down to 50 — past the lever's labeled "deep focus" range
5. Card flashes amber for 1.2s — tooltip: *"This is below your declared focus range. Keep going to switch modes."*

**Why it matters:** This is the *agentic feedback loop* in action. Every interaction has a visible+audible consequence. The amber flash + warning is the **affordance teaching the user** about its own boundaries — meta-UI.

---

### Beat 6 — Chat interjection (optional in journey, required for sponsor visibility)

Between Beat 5 and Beat 7, a chat panel slides up from the bottom (collapsible). Maya types: *"can you make it darker, like late night?"*

**What Maya sees:**
- Agent message streams in: *"Switching to night mode."*
- Scene `timeOfDay` uniform tweens from 0.4 → 0.9 over 2s
- Window glow warms, stars become visible through fog
- A new lever appears in the card: **Star intensity** — *the lever set just grew in response to her direction*

**Why it matters:** The chat surface proves the agent isn't just responding to dragging — it's a true conversation, and **the lever set itself is a living artifact**. Adding a lever via chat is a smaller-scale version of Beat 7's regeneration.

---

### Beat 7 — The mic drop: regeneration (0:55–1:10)

**State:** Maya pushed tempo too far down. Threshold crossed.

**What Maya sees:**
- A chime sound plays (`sfx_chime_regen.mp3`)
- Side-panel agent reasoning streams: *"Mood Architect: detecting energy drop. Reclassifying as wind-down session."*
- Lever Card animates: each lever folds upward and out, staggered, like origami unfolding in reverse
- New card unfurls in: *"For winding down"*
- New levers stagger in (different ones):
  1. **Valence** — melancholy → tender → hopeful
  2. **Pad density** — sparse → lush
  3. **Candlelight** — flicker rate
  4. **Breathing pace** — match-to-breath toggle + BPM
  5. **Ambient warmth** — color temperature slider
- Scene morphs: forest cabin → warm bedroom (uniforms tween over 3s, overlay layer crossfades)
- Audio crossfades to slower, pad-heavier loop

**What Maya does:** Sits back. Smiles. *"It noticed."*

**Why it matters:** This is the moment that wins the hackathon. Every other beat is in service of this one. The card *changing what controls exist* is the unfakeable GenUI signature.

---

### Beat 8 — Settle and work (1:10+)

**State:** Maya has stopped exploring. She's about to work.

**What Maya sees:**
- The Lever Card auto-collapses to a discrete edge tab after 30s of inactivity
- Scene becomes the dominant canvas
- Chat collapses to a thin pill at the bottom
- Goal text in top-left fades to 30%
- Timer (if break cadence was set) ticks down quietly

**What Maya does:** Begins debugging her flaky test. The room holds her.

**Why it matters:** A focus tool that demands attention has failed. After the demo arc, the UI must **disappear**.

---

## Screen inventory (MVP)

Just two screens. Both are the same canvas, different modes.

### Screen 1 — Welcome
- Single full-screen view
- Center: question + input + ghosted hint
- No nav, no logo, no chrome

### Screen 2 — The Room
Layered:
1. **Background:** WebGL scene (forest cabin or warm bedroom)
2. **Foreground HUD layer:**
   - Top-left: goal pill (small, mono) — *"deep focus · 90 min · debugging"*
   - Right side: Lever Card (collapsible)
   - Bottom: Chat pill (expandable to chat panel)
   - Far right edge: LangSmith trace tab (collapsible) — *"see reasoning"*

That's it. No settings, no profile, no menus. The whole app is two screens.

---

## Interaction patterns

### Levers
- **Sliders:** drag with spring physics; release snaps to nearest "labeled tick" if within 3% of one
- **Segmented controls:** click; if the choice triggers a scene change, 2s cross-dissolve
- **Toggles:** spring scale on click + soft thump SFX

### Out-of-bounds feedback
- When a value crosses the agent's declared range, lever color shifts amber, a soft pulse animates, tooltip appears
- After 3 seconds at out-of-bounds, the regen trigger fires

### Card transitions
- **Materialize:** stagger from top, 80ms apart per lever, 400ms total
- **Regenerate:** old card folds out top-to-bottom in 600ms, new card unfurls bottom-to-top in 600ms, total 1.2s
- **Collapse:** card slides into edge tab in 250ms

### Scene transitions
- All uniform tweens use `easeInOutCubic`
- Scene morphs are 3s; idle fades are 1s
- Camera does **not** move except in the cinematic opening

### Chat
- User-typed messages appear instantly
- Agent messages stream token-by-token at ~30 tps
- Chat auto-scrolls but lets the user scroll back without snapping

### Sound design
- Vinyl click on lever grab — `sfx_lever_grab.mp3`
- Soft tape-hiss whoosh on card materialize — `sfx_card_materialize.mp3`
- Soft chime on regeneration — `sfx_chime_regen.mp3`
- Tape-stop on undo — *(post-MVP)*

---

## What Maya never sees

To stay honest about scope:

- A login screen
- A settings panel
- A "save preset" button
- A pricing page
- A help tooltip on every element (the UI must be self-evident)
- Scene options other than forest cabin and warm bedroom
- More than two distinct lever card templates

---

## Acceptance criteria for user spec

- [ ] A new viewer (judge) can complete Beats 1–7 without any onboarding text or tooltip beyond what's specified
- [ ] The cinematic transition lasts exactly 8s and contains no UI chrome
- [ ] The lever card content reads as plainly written for a non-engineer
- [ ] The regeneration moment is visually unmistakable — every viewer understands "the UI just changed itself"
- [ ] After Beat 8, the UI fades and the room dominates
