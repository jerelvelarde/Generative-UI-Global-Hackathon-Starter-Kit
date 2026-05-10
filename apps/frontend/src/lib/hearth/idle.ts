"use client";

/**
 * F-15 — Idle UI fade.
 *
 * 30s without a user input → returns `true`. Any mousemove / keydown /
 * pointerdown / touchstart / wheel resets the timer.
 *
 * Components that should dim accept a `dimmed` prop and reduce opacity
 * (and let pointer events through, where appropriate). The scene itself
 * stays at full intensity per the spec — only the chrome fades.
 *
 * Why a hook instead of a Zustand flag:
 *  - State changes only on edges (idle ↔ active), so a single
 *    boolean upcast through React is cheap.
 *  - Keeps listener lifecycle scoped to the page mount; no module-global
 *    cleanup hazard.
 */
import { useEffect, useState } from "react";

export const IDLE_TIMEOUT_MS = 30_000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
] as const;

export function useIdle(timeoutMs: number = IDLE_TIMEOUT_MS): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onActivity = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), timeoutMs);
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    onActivity();

    return () => {
      clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [timeoutMs]);

  return idle;
}
