"use client";

/**
 * useLeverBinding — bind a Lever to its slot in the MoodProfile.
 *
 * The Lever Card is genuinely generative: the agent emits an array of Levers
 * tailored to the user's goal, each with a `bindTo` dot-path into the
 * MoodProfile (e.g. "music.bpm", "music.aux.rain", "visual.sceneId"). This
 * hook is the bridge — A's lever components (LeverSlider / LeverSegmented /
 * LeverToggle) consume `{ value, setValue, outOfBounds }` and stay dumb.
 *
 * File ownership per docs/05-team-plan.md:
 *   useLeverBinding.ts ← C (binding hook)
 *   LeverSlider.tsx, LeverSegmented.tsx, LeverToggle.tsx ← A (rendering)
 *
 * Out-of-bounds detection (F-07 amber → F-08 regen) lives in
 * lib/hearth/genui/outOfBounds.ts and is read here as a flag — this hook
 * doesn't run timers itself.
 */

import { useCallback, useMemo } from "react";
import { useHearthStore } from "@/lib/hearth/store";
import type { Lever } from "@/lib/hearth/schema";

export type LeverBinding = {
  /** Current value at lever.bindTo. May be number, string, or undefined for invalid paths. */
  value: number | string | undefined;
  /** Write a new value back to lever.bindTo. No-ops on invalid paths (logged in dev). */
  setValue: (next: number | string) => void;
  /** True when the bound value sits outside lever.outOfBoundsAt. Read-only flag. */
  outOfBounds: boolean;
};

/**
 * Subscribe to the leaf at `lever.bindTo` and return read/write handles.
 *
 * The selector reads through `getValueAt`, which means it re-runs whenever
 * the profile object identity changes (Zustand default shallow compare).
 * That's fine for the MVP — the Lever Card has at most ~5 levers and the
 * profile mutates on user drag or agent tool call, not on every frame.
 */
export function useLeverBinding(lever: Lever): LeverBinding {
  const value = useHearthStore((s) => s.getValueAt(lever.bindTo)) as
    | number
    | string
    | undefined;
  const setLeverValue = useHearthStore((s) => s.setLeverValue);

  const setValue = useCallback(
    (next: number | string) => {
      setLeverValue(lever.bindTo, next);
    },
    [setLeverValue, lever.bindTo],
  );

  const outOfBounds = useMemo(() => {
    if (typeof value !== "number") return false;
    const bounds = lever.outOfBoundsAt;
    if (!bounds) return false;
    if (bounds.lo !== undefined && value < bounds.lo) return true;
    if (bounds.hi !== undefined && value > bounds.hi) return true;
    return false;
  }, [value, lever.outOfBoundsAt]);

  return { value, setValue, outOfBounds };
}
