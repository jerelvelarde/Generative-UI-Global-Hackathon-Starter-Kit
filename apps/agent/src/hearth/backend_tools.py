"""Hearth — backend tools for the chat agent.

These are Python tools the LangGraph chat agent can invoke during a turn.
They differ from frontend tools (declared on the React side via
``useCopilotAction``) in that they execute in the Python process with
direct access to MoodProfile state and Gemini.

Two tools are exposed:

- ``classify_mood_for_goal(goal_text)`` — runs ``architect.classify_goal``
  and returns a ``Command`` that replaces ``state.profile`` with the
  fresh MoodProfile. Useful when the agent decides it needs a clean
  structured-output classification mid-conversation rather than emitting
  piecewise tool calls.

- ``regenerate_mood_profile(reason)`` — reads current ``state.profile``,
  runs ``architect.regenerate_for_reason`` (lever-id-disjoint regen),
  returns a ``Command`` that replaces the profile. This is the F-08
  mic-drop's deterministic path. The agent's prompt routes the user
  message ``"Regenerate the room: <reason>"`` here when wired.

Both tools fall back to presets on any failure (no key, schema fail,
quota) so the chat agent can never produce a broken state.

Wiring contract for runtime.py
------------------------------
::

    from hearth.backend_tools import make_hearth_backend_tools
    backend_tools = [*backend_tools, *make_hearth_backend_tools()]

The chat agent prompt (``MOOD_ARCHITECT_PROMPT``) already documents the
routing — when the user message starts with ``"Regenerate the room:"``,
it directs the agent to emit a fresh profile. With these tools wired,
the agent has a deterministic path for that emission.

Frontend tools are NOT redeclared here — see runtime.py docstring.
``updateLeverValue`` / ``addLever`` / ``swapScene`` /
``regenerateMoodProfile`` live on the React side and are forwarded to
the agent's tool list by ``CopilotKitMiddleware``.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from .architect import classify_goal, regenerate_for_reason
from .presets import DEEP_FOCUS_PRESET, PRESETS_BY_KIND
from .schema import MoodProfile

logger = logging.getLogger(__name__)


def _profile_from_state(state: Any) -> MoodProfile:
    """Read MoodProfile from injected state, falling back to DEEP_FOCUS_PRESET.

    The frontend's Zustand store is the canonical owner per F-06, but we
    do see a serialized snapshot here via the LangGraph state schema
    declared in ``MoodStateMiddleware``.
    """
    if isinstance(state, dict):
        raw = state.get("profile")
        if raw:
            try:
                return MoodProfile.model_validate(raw)
            except Exception as exc:  # noqa: BLE001 — fall back, don't crash
                logger.warning(
                    "[backend_tools] state.profile failed validation: %s; using default",
                    exc,
                )
    return DEEP_FOCUS_PRESET


@tool
def classify_mood_for_goal(
    goal_text: str,
    state: Annotated[Any, InjectedState],
) -> Command:
    """Classify a goal and emit a fresh MoodProfile.

    Use this when the user has provided (or restated) a free-text work
    goal and you want to reset the room to match it. Replaces
    ``state.profile`` wholesale. Falls back to DEEP_FOCUS_PRESET on any
    Gemini failure.

    Args:
        goal_text: The user's free-text goal description.
    """
    _ = state  # Unused for classify, but injected for symmetry with regen
    profile = classify_goal(goal_text)
    return Command(
        update={"profile": profile.model_dump(mode="json")},
    )


@tool
def regenerate_mood_profile(
    reason: str,
    state: Annotated[Any, InjectedState],
) -> Command:
    """F-08 mic-drop: emit a fresh MoodProfile reflecting a mood shift.

    The new profile's lever ids will be disjoint from the current
    profile's — this is enforced both via the system prompt and via a
    defensive fallback in ``architect.regenerate_for_reason``. The Lever
    Card animation reads as a category change, not a value tweak.

    Use when the user message starts with ``"Regenerate the room:"`` —
    that's the frontend's signal that an outOfBoundsAt lever has been
    sustained for >3s (F-07).

    Args:
        reason: Short explanation of what triggered the regen (e.g.
            ``"user pushed tempo to 50, below the deep_focus floor"``).
    """
    current = _profile_from_state(state)
    new_profile = regenerate_for_reason(
        original_goal=current.goal.description,
        current_profile=current,
        reason=reason,
    )
    return Command(
        update={"profile": new_profile.model_dump(mode="json")},
    )


def make_hearth_backend_tools() -> list[Any]:
    """Return the Hearth backend tool list for ``runtime.build_graph``.

    These can be concatenated with whatever else the project loads
    (e.g. Notion MCP tools for the legacy lead-triage runtime). For
    Hearth-only deployments, this is the entire backend tool surface.
    """
    return [classify_mood_for_goal, regenerate_mood_profile]


__all__ = [
    "classify_mood_for_goal",
    "regenerate_mood_profile",
    "make_hearth_backend_tools",
]
