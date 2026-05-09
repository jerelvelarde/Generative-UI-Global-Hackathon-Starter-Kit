"""MoodStateMiddleware — declares the Hearth MoodProfile fields on the
agent's TypedDict state schema so they survive STATE_SNAPSHOT round-trips,
and hydrates a fresh thread from DEEP_FOCUS_PRESET on the first turn.

Mirrors the pattern in ``lead_state.py``. Without the schema declaration
the agent's state would only contain ``messages``, ``jump_to``,
``structured_response``, ``copilotkit``. When the agent emits
``STATE_SNAPSHOT`` to the frontend, the snapshot replaces the frontend's
local ``agent.state``, wiping any keys the React handlers wrote via
``agent.setState``. By declaring those keys here, LangGraph carries them
through state-event emission so the frontend's `profile` survives reloads.

Hydration on a fresh thread:
- ``before_agent`` runs once per turn, before the model fires.
- If ``state.profile`` is empty, we hydrate from ``DEEP_FOCUS_PRESET``
  serialized as a plain dict — matches the shape Lyubah's Zustand store
  initializes with, so the frontend and agent see the same starting room.
- Within a thread that already has a profile, we never re-hydrate (and
  never overwrite user lever drags that already mutated the profile).

Field shapes mirror the TypeScript Zod schema in
``apps/frontend/src/lib/hearth/schema.ts`` — see ``schema.py`` in this
package for the canonical Pydantic source.
"""

from __future__ import annotations

from typing import Annotated, Any

from langchain.agents.middleware.types import AgentMiddleware, AgentState
from typing_extensions import NotRequired, TypedDict

from .presets import DEEP_FOCUS_PRESET


def _replace(_left: Any, right: Any) -> Any:
    """LangGraph reducer that always takes the most recent value.

    Profile updates are wholesale replacements — lever drags or agent
    tool calls compute the next profile snapshot client-side and ship it
    as a single object, not a partial merge.
    """
    return right


# TypedDict mirrors of the Pydantic MoodProfile shape. We keep these as
# loose dicts (``total=False``) so partial state during hydration / mid-turn
# never blows up the schema. The Pydantic schema in ``schema.py`` is the
# strict validator the agent's structured-output path runs against.

class _Goal(TypedDict, total=False):
    kind: str
    description: str
    durationMin: int


class _MusicAux(TypedDict, total=False):
    brownNoise: float
    rain: float


class _Music(TypedDict, total=False):
    bpm: float
    intensity: float
    valence: float
    aux: _MusicAux
    promptForGen: str


class _VisualUniforms(TypedDict, total=False):
    colorTempK: float
    rainIntensity: float
    fogDensity: float
    windowGlow: float
    timeOfDay: float
    motionRate: float
    vignette: float


class _Visual(TypedDict, total=False):
    sceneId: str
    uniforms: _VisualUniforms


class _LeverRange(TypedDict, total=False):
    min: float
    max: float
    default: float
    step: float


class _LeverOption(TypedDict, total=False):
    value: str
    label: str


class _OutOfBoundsAt(TypedDict, total=False):
    lo: float
    hi: float


class _Lever(TypedDict, total=False):
    id: str
    label: str
    kind: str
    description: str
    bindTo: str
    range: _LeverRange
    options: list[_LeverOption]
    outOfBoundsAt: _OutOfBoundsAt


class _Evolution(TypedDict, total=False):
    phase: str


class _MoodProfile(TypedDict, total=False):
    """Plain-dict mirror of the Pydantic MoodProfile in ``schema.py``."""

    goal: _Goal
    music: _Music
    visual: _Visual
    levers: list[_Lever]
    evolution: _Evolution


class HearthState(AgentState):
    """Extended agent state for the Hearth mood studio.

    `profile` is the single source of truth for the room — see F-06.
    Frontend-owned: lever drags and CopilotKit frontend tool calls mutate
    it client-side; the agent observes via subsequent turns and may emit
    a fresh profile when the goal classification changes (F-08 regen).
    """

    profile: NotRequired[Annotated[_MoodProfile, _replace]]


class MoodStateMiddleware(AgentMiddleware[HearthState, Any]):  # type: ignore[type-arg]
    """Contributes the Hearth state schema and hydrates fresh threads.

    LangGraph merges the state schemas of every middleware in the chain,
    so inserting this alongside CopilotKitMiddleware adds the `profile`
    field to the graph's state. The ``before_agent`` hook then ensures a
    fresh thread starts with the DEEP_FOCUS_PRESET profile so the frontend
    has a valid room to render from turn one — no empty-state flash.
    """

    state_schema = HearthState

    def before_agent(self, state: Any, runtime: Any) -> dict[str, Any] | None:
        """Hydrate empty `profile` from DEEP_FOCUS_PRESET on first turn."""
        existing = (state or {}).get("profile") if isinstance(state, dict) else None
        # A profile dict with at least a `goal.kind` is "populated."
        if existing and isinstance(existing, dict) and existing.get("goal"):
            return None

        return {"profile": DEEP_FOCUS_PRESET.model_dump(mode="json")}


__all__ = ["HearthState", "MoodStateMiddleware"]
