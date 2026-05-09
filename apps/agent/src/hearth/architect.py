"""Mood Architect — direct-call helpers for live MoodProfile generation.

The conversational agent in ``runtime.py`` routes through LangGraph and
the deepagents planner. That's correct for chat (the user types a message,
the agent picks among tools, eventually ends a turn). But two paths want
to bypass the planner and go straight to a structured MoodProfile:

1. **F-02 first-turn classification** — the user typed a goal in the
   welcome screen; we want a validated MoodProfile back, fast, with no
   planner-ish "let me think about this" preamble. The chat agent CAN do
   this, but a direct Gemini call is faster and easier to test.

2. **F-08 mic-drop regeneration** — the frontend detected an
   out-of-bounds lever for >3s and wants a fresh profile NOW, with
   different lever IDs from the current set. Going through the planner
   adds latency to the most demo-critical moment.

This module exposes both as plain Python functions:

- ``classify_goal(goal_text)`` → ``MoodProfile``
- ``regenerate_for_reason(original_goal, current, reason)`` → ``MoodProfile``

Both validate against the Pydantic schema, retry once on parse failure,
and fall back to a preset on persistent failure. They're callable from:

- The BFF (when added to the Hono routes for direct F-02/F-08 endpoints)
- ``scripts/verify_hearth.py`` (the F-02 acceptance gate)
- The chat agent itself (as a backend tool, when wired)
- Future tests

Gated behind a key check — if ``has_gemini_api_key()`` is False, both
functions short-circuit to the preset and log a one-line warning.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from gemini_keys import build_gemini_chat_model, has_gemini_api_key

from .presets import DEEP_FOCUS_PRESET, PRESETS_BY_KIND, WIND_DOWN_PRESET
from .schema import GoalKind, MoodProfile

logger = logging.getLogger(__name__)


_DEFAULT_MODEL = os.getenv("HEARTH_LIVE_MODEL", "gemini-3-flash-preview")
"""Override at runtime: ``HEARTH_LIVE_MODEL=gemini-3.1-pro-preview python …``"""


# --------------------------- system prompts --------------------------------

# Imported lazily to avoid a hard dep on prompts.py at module import (the
# chat agent already pulls prompts.py, so circular risk is low; lazy is
# defensive).

def _classify_system_prompt() -> str:
    """System prompt for the F-02 first-turn classification path.

    Asks Gemini to emit ONLY a MoodProfile via the bound structured-output
    tool — no chat reply, no other tool calls. This matches what we want
    in the welcome → cinematic-transition flow.
    """
    from prompts import build_system_prompt

    return build_system_prompt() + (
        "\n\nSPECIAL INSTRUCTION FOR THIS TURN: respond ONLY by returning "
        "a MoodProfile via the bound structured-output tool. Do not chat. "
        "Do not call any other tool. The frontend renders the profile "
        "directly; your reply text is discarded."
    )


def _regen_system_prompt(*, avoid_ids: set[str]) -> str:
    """System prompt for the F-08 mic-drop regeneration path.

    Adds the disjointness constraint — the new profile's levers MUST NOT
    reuse any lever id from ``avoid_ids``. This is what makes the lever
    card animation read as a category change rather than a value tweak.
    """
    from prompts import build_system_prompt

    avoid_clause = (
        f"  The new profile MUST NOT reuse any of these lever ids "
        f"(they were just animated out): "
        f"{sorted(avoid_ids) if avoid_ids else '(none)'}.\n"
    )
    return build_system_prompt() + (
        "\n\nSPECIAL INSTRUCTION FOR THIS TURN (regeneration): the user "
        "has crossed an outOfBoundsAt threshold for >3s. Their behavior "
        "implies a different mood category from their original goal.\n"
        + avoid_clause
        + "Emit a fresh MoodProfile via the bound structured-output tool. "
        "Pick a different goal.kind from the original. Pick a different "
        "set of levers (different ids, different controls), not just "
        "different values. The Lever Card transition reads 'category "
        "change' only when ids differ. Do not chat; do not call other "
        "tools."
    )


# --------------------------- internal core ---------------------------------


def _validate_or_preset(
    raw: Any,
    *,
    fallback_kind: str,
    label: str,
) -> MoodProfile:
    """Validate ``raw`` as MoodProfile; fall back to PRESETS_BY_KIND[kind] on failure.

    Pydantic raises ValidationError on shape mismatch. We log + fall back
    rather than re-raising — the demo path values reliability over
    correctness. The fallback preset will look right on screen even if
    the agent's reasoning was off.
    """
    if isinstance(raw, MoodProfile):
        return raw
    try:
        return MoodProfile.model_validate(raw)
    except Exception as exc:  # noqa: BLE001 — fallback path
        logger.warning(
            "[architect] %s: schema validation failed (%s); falling back to %s preset",
            label,
            exc,
            fallback_kind,
        )
        return PRESETS_BY_KIND.get(fallback_kind, DEEP_FOCUS_PRESET)


def _structured_call(
    *,
    system: str,
    user: str,
    model: str,
    label: str,
    fallback_kind: str,
) -> MoodProfile:
    """One Gemini call with structured-output tool binding + 1 retry."""
    if not has_gemini_api_key():
        logger.warning(
            "[architect] %s: no GEMINI_API_KEY — using %s preset",
            label,
            fallback_kind,
        )
        return PRESETS_BY_KIND.get(fallback_kind, DEEP_FOCUS_PRESET)

    llm = build_gemini_chat_model(model=model, temperature=0)
    structured = llm.with_structured_output(MoodProfile, method="function_calling")
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    last_exc: Exception | None = None
    for attempt in (1, 2):
        try:
            result = structured.invoke(messages)
            return _validate_or_preset(
                result, fallback_kind=fallback_kind, label=f"{label}/attempt-{attempt}"
            )
        except Exception as exc:  # noqa: BLE001 — retry path
            last_exc = exc
            logger.info(
                "[architect] %s attempt %d failed: %s — retrying",
                label,
                attempt,
                exc,
            )

    logger.warning(
        "[architect] %s: both attempts failed (%s); falling back to %s preset",
        label,
        last_exc,
        fallback_kind,
    )
    return PRESETS_BY_KIND.get(fallback_kind, DEEP_FOCUS_PRESET)


# ----------------------------- public API ----------------------------------


def classify_goal(
    goal_text: str,
    *,
    model: str = _DEFAULT_MODEL,
) -> MoodProfile:
    """F-02 — Free-text goal → validated MoodProfile.

    The user typed something in the welcome screen; this returns the
    structured profile to drive the room. Validates against the schema
    and falls back to DEEP_FOCUS_PRESET on any failure (quota, parse,
    safety, network).

    Args:
        goal_text: User's free-text input. Truncated to 500 chars per F-01.
        model: Gemini model id. Override via HEARTH_LIVE_MODEL.
    """
    if not goal_text or not goal_text.strip():
        # Empty goal: serve a default room, no API call.
        return DEEP_FOCUS_PRESET

    truncated = goal_text.strip()[:500]
    return _structured_call(
        system=_classify_system_prompt(),
        user=truncated,
        model=model,
        label="classify_goal",
        # If we can't classify, default to deep_focus — the most universal
        # focus-tool default. The user can adjust via levers.
        fallback_kind="deep_focus",
    )


def regenerate_for_reason(
    *,
    original_goal: str,
    current_profile: MoodProfile,
    reason: str,
    model: str = _DEFAULT_MODEL,
) -> MoodProfile:
    """F-08 — Emit a fresh MoodProfile reflecting a mood category shift.

    Triggered by the frontend when a lever crosses outOfBoundsAt for >3s.
    The new profile's lever ids MUST NOT overlap with the current
    profile's lever ids — that's how the Lever Card transition reads as
    a category change rather than a value tweak.

    Args:
        original_goal: The user's original free-text goal (passed for
            grounding; the regen still respects intent).
        current_profile: The profile being replaced. Its lever ids are
            extracted into the prompt's avoid set.
        reason: Short string explaining what triggered regen (e.g.
            "user pushed tempo to 50, below the deep_focus floor of 55").
        model: Gemini model id.

    Returns:
        New MoodProfile. On schema or API failure, falls back to the
        WIND_DOWN_PRESET if the current profile is deep_focus, else
        DEEP_FOCUS_PRESET — the simplest "category change" the demo path
        can guarantee.
    """
    avoid_ids = {l.id for l in current_profile.levers}

    # Pick the fallback that's the most-different category from current.
    if current_profile.goal.kind == "deep_focus":
        fallback_kind = "wind_down"
    else:
        fallback_kind = "deep_focus"

    user_msg = (
        f"Original goal: {original_goal!r}\n"
        f"Current goal kind: {current_profile.goal.kind}\n"
        f"Trigger reason: {reason}\n"
        f"\nEmit a fresh MoodProfile in a different mood category."
    )

    new_profile = _structured_call(
        system=_regen_system_prompt(avoid_ids=avoid_ids),
        user=user_msg,
        model=model,
        label="regenerate_for_reason",
        fallback_kind=fallback_kind,
    )

    # Defensive disjointness: if the model still reused ids despite the
    # prompt, force a fallback. This is the demo-protecting invariant.
    new_ids = {l.id for l in new_profile.levers}
    if avoid_ids & new_ids:
        logger.warning(
            "[architect] regenerate_for_reason: model reused lever ids %s — "
            "forcing %s preset to keep regen visually distinct",
            sorted(avoid_ids & new_ids),
            fallback_kind,
        )
        return PRESETS_BY_KIND.get(fallback_kind, WIND_DOWN_PRESET)

    return new_profile


__all__ = ["classify_goal", "regenerate_for_reason"]
