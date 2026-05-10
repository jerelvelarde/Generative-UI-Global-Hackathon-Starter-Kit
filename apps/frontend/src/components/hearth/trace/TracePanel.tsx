"use client";

/**
 * F-13 — LangSmith trace panel (MVP, stylized).
 *
 * Right-edge collapsible tab. Reads from the in-memory trace store
 * (src/lib/hearth/trace.ts) which is populated by:
 *   - the agent → store bridge (Mood Architect emissions)
 *   - the four CopilotKit frontend tools
 *   - the F-08 out-of-bounds detector
 *
 * Real LangSmith integration is stretch (F-19); the spec explicitly says
 * "stylized; data may be hardcoded" for MVP. We use the real local trace
 * stream because we have it for free — that already covers the demo arc.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { TRACE_KIND_LABEL, useTraceStore, type TraceEvent } from "@/lib/hearth/trace";

const KIND_ACCENT: Record<TraceEvent["kind"], string> = {
  "agent.profile.applied": "bg-amber-500",
  "regen.trigger": "bg-rose-500",
  "lever.out_of_bounds.fire": "bg-rose-500",
  "lever.out_of_bounds.cancel": "bg-stone-500",
  "tool.updateLeverValue": "bg-sky-400",
  "tool.addLever": "bg-emerald-400",
  "tool.swapScene": "bg-violet-400",
  "tool.regenerateMoodProfile": "bg-rose-400",
};

function formatRelative(now: number, ts: number): string {
  const delta = Math.max(0, now - ts);
  if (delta < 1000) return "now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  return `${Math.floor(delta / 60_000)}m ago`;
}

export function TracePanel({ dimmed = false }: { dimmed?: boolean }) {
  const [open, setOpen] = useState(false);
  const events = useTraceStore((s) => s.events);

  // Memoize "now" per render so timestamps are stable inside one paint;
  // the parent layout already re-renders on store changes.
  const now = useMemo(() => Date.now(), [events]);

  return (
    <div
      className={`fixed top-0 right-0 z-30 h-screen pointer-events-none transition-opacity duration-700 ${
        dimmed ? "opacity-30" : "opacity-100"
      }`}
    >
      {/* Edge tab — always visible, click to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto absolute top-1/2 right-0 -translate-y-1/2 px-2 py-6 bg-stone-900/80 backdrop-blur border-l border-y border-stone-800 rounded-l-md text-stone-400 hover:text-amber-400 transition-colors"
        aria-label={open ? "Collapse trace panel" : "Expand trace panel"}
      >
        <span className="text-[10px] uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
          {open ? "Close trace" : "Agent trace"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="pointer-events-auto absolute top-0 right-0 h-full w-[30vw] min-w-[320px] max-w-[420px] bg-stone-950/95 backdrop-blur border-l border-stone-800 flex flex-col"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-stone-500">
                  LangSmith
                </span>
                <span className="text-sm font-medium text-stone-100">
                  Agent trace
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-stone-500">
                {events.length} {events.length === 1 ? "event" : "events"}
              </span>
            </header>

            <ol className="flex-1 overflow-y-auto p-3 space-y-2">
              {events.length === 0 && (
                <li className="text-xs text-stone-600 italic px-2 py-8 text-center">
                  No agent activity yet. Submit a goal or drag a lever.
                </li>
              )}
              {events.map((e) => (
                <li
                  key={e.id}
                  className="relative bg-stone-900/60 border border-stone-800 rounded-md p-3 pl-4"
                >
                  <span
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${KIND_ACCENT[e.kind]}`}
                    aria-hidden
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-stone-500">
                      {TRACE_KIND_LABEL[e.kind]}
                    </span>
                    <span className="text-[10px] text-stone-600 font-mono shrink-0">
                      {formatRelative(now, e.ts)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-stone-100">{e.label}</div>
                  {e.detail && (
                    <div className="mt-1 text-xs text-stone-400 font-mono break-words">
                      {e.detail}
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <footer className="px-5 py-3 border-t border-stone-800 text-[10px] uppercase tracking-widest text-stone-600">
              CopilotKit · Gemini · LangGraph · LangSmith
            </footer>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
