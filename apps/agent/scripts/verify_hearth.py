"""Smoke test for the Hearth Mood Architect.

Run this BEFORE the demo. It exercises three layers in isolation:

1. Schema layer: Pydantic round-trips the sample JSON and both presets.
2. Middleware layer: MoodStateMiddleware hydrates an empty state from
   DEEP_FOCUS_PRESET on the first turn and is a no-op afterward.
3. Prompt layer: build_system_prompt composes a non-empty Mood Architect
   prompt with the required markers.

If you have GEMINI_API_KEYS / GEMINI_API_KEY set, it ALSO runs a single live
classification turn against five test goals and reports how many pass schema
validation. This is the F-02 acceptance gate (≥ 4/5 valid). Skip it (no key) and the
script still verifies the offline path is sound.

Usage::

    cd apps/agent
    uv run python scripts/verify_hearth.py
    # or:
    PYTHONPATH=src python scripts/verify_hearth.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow `python scripts/verify_hearth.py` from apps/agent without uv.
_HERE = Path(__file__).resolve()
_SRC = _HERE.parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

# Repo root, for finding the sample JSON without depending on cwd.
_REPO_ROOT = _HERE.parents[3]
_SAMPLE_JSON = _REPO_ROOT / "docs" / "samples" / "sample-mood-profile.json"


# ---------------------------------------------------------------------- 1


def check_schema() -> None:
    from hearth.presets import DEEP_FOCUS_PRESET, WIND_DOWN_PRESET
    from hearth.schema import MoodProfile

    # Round-trip the sample JSON.
    raw = json.loads(_SAMPLE_JSON.read_text())
    raw.pop("_comment", None)
    sample = MoodProfile.model_validate(raw)
    assert sample.goal.kind == "deep_focus"
    assert len(sample.levers) == 5
    print(f"  ✓ sample JSON validates (levers={len(sample.levers)})")

    # Both presets serialize → deserialize losslessly.
    for name, preset in [
        ("DEEP_FOCUS_PRESET", DEEP_FOCUS_PRESET),
        ("WIND_DOWN_PRESET", WIND_DOWN_PRESET),
    ]:
        round_tripped = MoodProfile.model_validate(preset.model_dump(mode="json"))
        assert round_tripped == preset, f"{name} round-trip mismatch"
        print(f"  ✓ {name} round-trips ({len(preset.levers)} levers)")

    # Lever ID disjointness — required for the regen mic-drop animation.
    focus_ids = {l.id for l in DEEP_FOCUS_PRESET.levers}
    wind_ids = {l.id for l in WIND_DOWN_PRESET.levers}
    assert not (focus_ids & wind_ids), (
        f"presets share lever ids — regen will look like a value tweak: "
        f"{focus_ids & wind_ids}"
    )
    print("  ✓ presets share zero lever IDs (regen will read as category change)")


# ---------------------------------------------------------------------- 2


def check_middleware() -> None:
    from hearth.mood_state import MoodStateMiddleware
    from hearth.presets import DEEP_FOCUS_PRESET

    mw = MoodStateMiddleware()

    # Fresh state hydrates.
    update = mw.before_agent({}, runtime=None)
    assert update is not None and "profile" in update
    assert update["profile"]["goal"]["kind"] == "deep_focus"
    print("  ✓ empty state hydrates from DEEP_FOCUS_PRESET")

    # Hydrated state is left alone (idempotent within thread).
    seeded = {"profile": DEEP_FOCUS_PRESET.model_dump(mode="json")}
    assert mw.before_agent(seeded, runtime=None) is None
    print("  ✓ hydrated state is not re-hydrated")

    # User has mutated levers? Don't overwrite.
    mutated = {"profile": {"goal": {"kind": "wind_down"}, "levers": []}}
    assert mw.before_agent(mutated, runtime=None) is None
    print("  ✓ user-mutated state is not overwritten")


# ---------------------------------------------------------------------- 3


def check_prompts() -> None:
    from prompts import build_system_prompt

    prompt = build_system_prompt("ignored")
    assert "Mood Architect" in prompt
    assert "updateLeverValue" in prompt
    assert "regenerateMoodProfile" in prompt
    assert "outOfBoundsAt" in prompt
    assert "forest_cabin" in prompt
    print(f"  ✓ system prompt composes (len={len(prompt)} chars)")


# ---------------------------------------------------------------------- 4 (live)


_TEST_GOALS = [
    ("Debugging a flaky integration test, need 90 minutes of deep focus.", "deep_focus"),
    ("Winding down after a long sprint, helping me decompress.", "wind_down"),
    ("Writing a tender letter to my grandmother for her birthday.", "creative"),
    ("Doing a high-intensity coding sprint to ship before standup.", "energetic"),
    ("Reading a dense paper on distributed systems for an hour.", "deep_focus"),
]


def check_live_classify() -> None:
    """F-02 acceptance: 5 goals → ≥4 valid MoodProfiles via architect.classify_goal."""
    from gemini_keys import has_gemini_api_key

    if not has_gemini_api_key():
        print("  ⊘ GEMINI_API_KEYS / GEMINI_API_KEY not set — skipping live check")
        print("      Set GEMINI_API_KEYS to run F-02 acceptance (≥4/5 valid).")
        return

    try:
        import langchain_google_genai  # noqa: F401
    except ImportError:
        print("  ⊘ langchain_google_genai not installed — skipping live check")
        return

    from hearth.architect import classify_goal

    passes = 0
    for goal, expected_kind in _TEST_GOALS:
        try:
            profile = classify_goal(goal)
            ok = (
                profile.goal.kind == expected_kind
                and 4 <= len(profile.levers) <= 6
                and any(l.outOfBoundsAt for l in profile.levers)
            )
            mark = "✓" if ok else "✗"
            print(
                f"  {mark} '{goal[:48]}…' → kind={profile.goal.kind} "
                f"({len(profile.levers)} levers, "
                f"oob={sum(1 for l in profile.levers if l.outOfBoundsAt)})"
            )
            if ok:
                passes += 1
        except Exception as e:  # noqa: BLE001 — diagnostics only
            print(f"  ✗ '{goal[:48]}…' → error: {e}")

    print(f"  → {passes}/5 passed (acceptance gate: ≥ 4)")


def check_live_regen() -> None:
    """F-08 acceptance: regen produces lever-id-disjoint profile from current."""
    from gemini_keys import has_gemini_api_key

    if not has_gemini_api_key():
        print("  ⊘ GEMINI_API_KEYS / GEMINI_API_KEY not set — skipping regen check")
        return

    from hearth.architect import regenerate_for_reason
    from hearth.presets import DEEP_FOCUS_PRESET

    current = DEEP_FOCUS_PRESET
    new = regenerate_for_reason(
        original_goal="Debugging a flaky integration test, need 90 minutes of deep focus.",
        current_profile=current,
        reason="user pushed tempo to 50, below the deep_focus floor of 55",
    )
    current_ids = {l.id for l in current.levers}
    new_ids = {l.id for l in new.levers}
    overlap = current_ids & new_ids

    print(f"  → new goal.kind: {new.goal.kind} (was {current.goal.kind})")
    print(f"  → new scene: {new.visual.sceneId} (was {current.visual.sceneId})")
    print(f"  → lever id overlap: {sorted(overlap) if overlap else 'none ✓'}")
    if overlap:
        print("  ✗ regen reused lever ids — Lever Card animation will read as value tweak")
    elif new.goal.kind == current.goal.kind:
        print("  ✗ regen kept same goal kind — mic-drop won't read as category change")
    else:
        print("  ✓ regen produced visually-distinct profile")


# ---------------------------------------------------------------------- main


def main() -> int:
    print("[1/5] Schema")
    check_schema()
    print("[2/5] Middleware")
    check_middleware()
    print("[3/5] Prompt composition")
    check_prompts()
    print("[4/5] Live F-02 classification (5 test goals)")
    check_live_classify()
    print("[5/5] Live F-08 regeneration (deep_focus → ?)")
    check_live_regen()
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
