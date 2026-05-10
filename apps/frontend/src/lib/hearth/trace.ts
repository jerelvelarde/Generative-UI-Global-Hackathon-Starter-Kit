/**
 * Hearth trace store — feeds the F-13 trace panel.
 *
 * MVP per docs/03-functional-spec.md F-13: stylized event log, real
 * LangSmith integration is stretch (F-19). We push every meaningful agent
 * + wiring event into a bounded ring buffer; the panel renders newest-first.
 *
 * Sources that push here (search for `recordTrace(`):
 *  - regenerate.ts triggerRegen        → "regen.trigger"
 *  - outOfBounds.ts fire / cancel      → "lever.out_of_bounds.fire" / ".cancel"
 *  - hearth-tools.tsx tool handlers    → "tool.updateLeverValue" etc.
 *  - useAgentProfileBridge             → "agent.profile.applied"
 *
 * Module-level `recordTrace()` is callable from non-React code (e.g. the
 * out-of-bounds setTimeout) — same pattern as triggerRegen in regenerate.ts.
 */
import { create } from "zustand";

export type TraceKind =
  | "agent.profile.applied"
  | "regen.trigger"
  | "lever.out_of_bounds.fire"
  | "lever.out_of_bounds.cancel"
  | "tool.updateLeverValue"
  | "tool.addLever"
  | "tool.swapScene"
  | "tool.regenerateMoodProfile";

export type TraceEvent = {
  id: string;
  kind: TraceKind;
  /** Short, judge-readable label. */
  label: string;
  /** Optional one-liner detail rendered under the label. */
  detail?: string;
  /** Epoch ms. */
  ts: number;
};

const MAX_EVENTS = 30;

type TraceState = {
  events: TraceEvent[];
  push: (e: Omit<TraceEvent, "id" | "ts">) => void;
  clear: () => void;
};

export const useTraceStore = create<TraceState>((set) => ({
  events: [],
  push: (e) =>
    set((state) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `trace-${Date.now()}-${Math.random()}`;
      const next = [{ ...e, id, ts: Date.now() }, ...state.events];
      if (next.length > MAX_EVENTS) next.length = MAX_EVENTS;
      return { events: next };
    }),
  clear: () => set({ events: [] }),
}));

/**
 * Module-level helper. Mirrors triggerRegen's "callable from outside React"
 * pattern so detectors and async tool handlers can append without a hook.
 */
export function recordTrace(e: Omit<TraceEvent, "id" | "ts">): void {
  useTraceStore.getState().push(e);
}

/** Human-readable label for the agent kind, used in the panel header. */
export const TRACE_KIND_LABEL: Record<TraceKind, string> = {
  "agent.profile.applied": "Mood Architect",
  "regen.trigger": "Regenerate signal",
  "lever.out_of_bounds.fire": "Out-of-bounds → regen",
  "lever.out_of_bounds.cancel": "Out-of-bounds (snap back)",
  "tool.updateLeverValue": "Tool: updateLeverValue",
  "tool.addLever": "Tool: addLever",
  "tool.swapScene": "Tool: swapScene",
  "tool.regenerateMoodProfile": "Tool: regenerateMoodProfile",
};
