"""Hearth MoodProfile — Pydantic schema.

THE SOURCE OF TRUTH. Everything downstream derives from this:
- The Mood Architect agent emits MoodProfile via Gemini structured output.
- The frontend Zod mirror at apps/frontend/src/lib/hearth/schema.ts MUST
  match this file field-for-field. When you edit one, edit the other.
- Lever bindTo paths are dot-paths into MoodProfile. Invalid paths are
  caught at runtime — the lever drags but doesn't mutate anything.

If you change this file, ping the team channel. A and C are mocking
against docs/samples/sample-mood-profile.json — that file must update too.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ----------------------------- enums ---------------------------------------

GoalKind = Literal["deep_focus", "wind_down", "creative", "energetic"]
"""The mood category. Mood Architect picks one based on free-text goal.
The mic-drop regen (F-08) fires when user behavior implies a different
goal kind from the one originally classified."""

SceneId = Literal["forest_cabin", "warm_bedroom"]
"""WebGL scene templates. MVP ships only these two; warm_bedroom is the
regen target. Adding more scenes is straightforward but out of MVP scope."""

LeverKind = Literal["slider", "segmented", "toggle"]


# ------------------------ lever sub-types ----------------------------------


class LeverRange(BaseModel):
    """Slider bounds. `default` is what the agent sets initially; `step`
    snaps drag values when set (else continuous)."""

    min: float
    max: float
    default: float
    step: Optional[float] = None


class LeverOption(BaseModel):
    """One choice in a segmented control."""

    value: str
    label: str


class OutOfBoundsAt(BaseModel):
    """Defines the lever's "valid range for this goal." Crossing either
    threshold for >3s triggers F-07 (amber state) and then F-08 (regen).
    A lever with no `outOfBoundsAt` never triggers regen."""

    lo: Optional[float] = None
    hi: Optional[float] = None


class Lever(BaseModel):
    """One control on the Lever Card. The agent emits an array of these
    tailored to the user's goal. Plain-language labels — no DSP jargon."""

    id: str
    """Stable identifier (snake_case). Used by frontend tools to address
    a specific lever (e.g., updateLeverValue('tempo', 65))."""

    label: str
    """User-visible. Plain language."""

    kind: LeverKind

    description: Optional[str] = None
    """Optional hover tooltip. One short sentence."""

    bindTo: str
    """Dot-path into MoodProfile that this lever writes when dragged.
    Examples: 'music.bpm', 'music.aux.rain', 'visual.sceneId'."""

    range: Optional[LeverRange] = None
    """Required for kind='slider'. Ignored for segmented/toggle."""

    options: Optional[list[LeverOption]] = None
    """Required for kind='segmented'. Ignored for slider/toggle."""

    outOfBoundsAt: Optional[OutOfBoundsAt] = None


# ------------------------- profile sub-types -------------------------------


class Goal(BaseModel):
    kind: GoalKind
    description: str
    """Verbatim from user's free-text input (truncated to 500 chars)."""
    durationMin: int
    """Minutes the user said they have. Defaults to 60 if not stated."""


class MusicAux(BaseModel):
    """Audio underlayers crossfaded on top of the main loop."""

    brownNoise: float = Field(ge=0.0, le=1.0)
    rain: float = Field(ge=0.0, le=1.0)


class Music(BaseModel):
    bpm: float
    """Drives clip selection (low/mid/high focus or wind-down). MVP does
    NOT time-stretch audio — bpm changes which clip plays, not the tempo
    of the playing clip."""

    intensity: float = Field(ge=0.0, le=1.0)
    """0..1 crossfade weight across the focus clip stack."""

    valence: float = Field(ge=-1.0, le=1.0)
    """-1 melancholy .. 0 neutral .. +1 hopeful. Used by wind-down."""

    aux: MusicAux

    promptForGen: str
    """Lyria prompt. Used only when USE_LYRIA=true (stretch F-16)."""


class VisualUniforms(BaseModel):
    """Shader uniforms. The renderer lerps these per frame for smooth
    transitions when the agent updates the profile."""

    colorTempK: float = Field(ge=2700.0, le=6500.0)
    rainIntensity: float = Field(ge=0.0, le=1.0)
    fogDensity: float = Field(ge=0.0, le=1.0)
    windowGlow: float = Field(ge=0.0, le=1.0)
    timeOfDay: float = Field(ge=0.0, le=1.0)
    """0=dawn, 0.5=midday, 1=night."""
    motionRate: float = Field(ge=0.0, le=1.0)
    vignette: float = Field(ge=0.0, le=1.0)


class Visual(BaseModel):
    sceneId: SceneId
    uniforms: VisualUniforms


class Evolution(BaseModel):
    phase: Literal["ramp", "sustain", "wind_down"]


# ----------------------------- root ----------------------------------------


class MoodProfile(BaseModel):
    """The single source of truth for what the room is right now.

    Frontend-owned per F-06: the agent emits initial profile, then the
    frontend mutates it via lever drags + tool calls. The agent observes
    via subsequent turns; it does not stream-edit during a single turn."""

    goal: Goal
    music: Music
    visual: Visual
    levers: list[Lever]
    """The goal-specific control surface. The whole point of GenUI:
    this list is generated by the agent, not hardcoded by a designer."""

    evolution: Evolution


__all__ = [
    "GoalKind",
    "SceneId",
    "LeverKind",
    "LeverRange",
    "LeverOption",
    "OutOfBoundsAt",
    "Lever",
    "Goal",
    "MusicAux",
    "Music",
    "VisualUniforms",
    "Visual",
    "Evolution",
    "MoodProfile",
]
