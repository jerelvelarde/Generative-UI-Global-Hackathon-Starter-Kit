"use client";

/**
 * F-08 detector — fire triggerRegen() once a lever has sustained
 * out-of-bounds for OUT_OF_BOUNDS_HOLD_MS.
 *
 * Per docs/03-functional-spec.md F-07/F-08:
 *  - F-07 (amber visual) is the *instantaneous* "currently out of bounds"
 *    flag, exposed by useLeverBinding so A's lever components can paint
 *    amber the moment a value crosses outOfBoundsAt.
 *  - F-08 (mic-drop regen) is the *time-based* trigger handled here:
 *    after 3s sustained out-of-bounds on any single lever, we send
 *    "Regenerate the room: <reason>" to the agent (via triggerRegen,
 *    which Agent 2 implements in ./regenerate).
 *
 * Mounting:
 *  Call useOutOfBoundsDetector() once inside HearthFrontendTools (or any
 *  always-mounted component under the CopilotKitProvider tree). One call
 *  per page lifecycle; per-lever timer state is owned by the hook.
 *
 * Behavior contract:
 *  - One pending timer per lever id. Re-entry while armed is a no-op.
 *  - Returning in-bounds clears the timer and re-arms (next exit can fire).
 *  - On fire, hasFired latches until the user goes back in-bounds OR the
 *    profile's lever set changes (regen swapped them). Prevents double-
 *    fire when two levers cross thresholds in the same window.
 *  - When profile.levers identity changes (new ids set), all timers and
 *    fired flags reset — the new profile is a clean slate.
 *  - Non-numeric levers (segmented / toggle) skip detection — outOfBoundsAt
 *    is only meaningful for numeric values per the schema.
 */

import { useEffect, useRef } from "react";

import { useHearthStore } from "@/lib/hearth/store";
import type { Lever, MoodProfile } from "@/lib/hearth/schema";

import { triggerRegen } from "./regenerate";

/** 3 seconds. Match docs/03-functional-spec.md F-07. */
export const OUT_OF_BOUNDS_HOLD_MS = 3000;

type LeverDetectorState = {
  timer: ReturnType<typeof setTimeout> | null;
  hasFired: boolean;
};

function readNumberAtPath(profile: MoodProfile, path: string): number | null {
  const raw = path.split(".").reduce<unknown>((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, profile);
  return typeof raw === "number" ? raw : null;
}

function isOutOfBounds(value: number, lever: Lever): boolean {
  const bounds = lever.outOfBoundsAt;
  if (!bounds) return false;
  if (bounds.lo !== undefined && value < bounds.lo) return true;
  if (bounds.hi !== undefined && value > bounds.hi) return true;
  return false;
}

function describeReason(lever: Lever, value: number): string {
  const lo = lever.outOfBoundsAt?.lo;
  const hi = lever.outOfBoundsAt?.hi;
  // Plain-language reason — gets passed to Gemini; it should read naturally.
  // E.g. "user pushed 'Tempo' to 50, below the floor of 55 (held 3s)"
  const direction =
    lo !== undefined && value < lo
      ? `below the floor of ${lo}`
      : hi !== undefined && value > hi
        ? `above the ceiling of ${hi}`
        : "outside the comfort range";
  return `user pushed '${lever.label}' to ${value}, ${direction} (held ${OUT_OF_BOUNDS_HOLD_MS / 1000}s)`;
}

function clearAllTimers(map: Map<string, LeverDetectorState>): void {
  for (const s of map.values()) {
    if (s.timer) clearTimeout(s.timer);
  }
  map.clear();
}

/**
 * Subscribe to the store and run the per-lever 3s detector. Mount once.
 *
 * Implementation note: we subscribe outside React's render cycle via
 * `useHearthStore.subscribe(...)` rather than relying on a selector + effect,
 * because the detector needs to react to *every* profile mutation
 * (including transient drag values) without paying a re-render. The
 * subscription closure reads timer state through a ref so the listener
 * stays stable for the lifetime of the hook.
 */
export function useOutOfBoundsDetector(): void {
  const detectorState = useRef<Map<string, LeverDetectorState>>(new Map());
  const leverIdsFingerprint = useRef<string>("");

  useEffect(() => {
    const tick = (profile: MoodProfile) => {
      const fingerprint = profile.levers
        .map((l) => l.id)
        .sort()
        .join(",");

      // Lever set changed (regen happened, or addLever fired) — full reset.
      if (fingerprint !== leverIdsFingerprint.current) {
        clearAllTimers(detectorState.current);
        leverIdsFingerprint.current = fingerprint;
      }

      for (const lever of profile.levers) {
        if (!lever.outOfBoundsAt) continue;

        const value = readNumberAtPath(profile, lever.bindTo);
        if (value === null) continue;

        const out = isOutOfBounds(value, lever);
        let s = detectorState.current.get(lever.id);
        if (!s) {
          s = { timer: null, hasFired: false };
          detectorState.current.set(lever.id, s);
        }

        if (!out) {
          // Snap-back: cancel pending timer and re-arm for the next exit.
          if (s.timer) {
            clearTimeout(s.timer);
            s.timer = null;
          }
          s.hasFired = false;
          continue;
        }

        // Out-of-bounds. If already armed or already fired, ignore.
        if (s.timer || s.hasFired) continue;

        const armedReason = describeReason(lever, value);
        const stateRefForFire = s;
        s.timer = setTimeout(() => {
          // Re-check at fire time — value may have snapped back since we armed.
          const finalProfile = useHearthStore.getState().profile;
          const finalValue = readNumberAtPath(finalProfile, lever.bindTo);
          stateRefForFire.timer = null;
          if (
            finalValue !== null &&
            isOutOfBounds(finalValue, lever) &&
            !stateRefForFire.hasFired
          ) {
            stateRefForFire.hasFired = true;
            const finalReason = describeReason(lever, finalValue);
            if (process.env.NODE_ENV !== "production") {
              console.log("[hearth] F-08 fire:", finalReason);
            }
            triggerRegen(finalReason);
          } else if (process.env.NODE_ENV !== "production") {
            console.log("[hearth] F-08 cancelled (snap-back):", armedReason);
          }
        }, OUT_OF_BOUNDS_HOLD_MS);
      }
    };

    // Run once on mount against the current profile, then subscribe.
    tick(useHearthStore.getState().profile);
    const unsubscribe = useHearthStore.subscribe((store) => tick(store.profile));

    return () => {
      unsubscribe();
      clearAllTimers(detectorState.current);
    };
  }, []);
}
