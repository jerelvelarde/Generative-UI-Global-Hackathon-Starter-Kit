"use client";

/**
 * F-14 — Goal pill.
 *
 * Top-left mono pill, format: `{kind} · {duration}m · {short description}`.
 * Click reveals a popover with the full original goal text.
 *
 * Per docs/03-functional-spec.md F-14, this appears at the 7s mark of the
 * cinematic transition. We render unconditionally when there's a goal — the
 * cinematic transition isn't built yet (A-track), so gating on a transition
 * timer would mean the pill never shows. Show as soon as a real goal lands.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { useHearthStore } from "@/lib/hearth/store";

const MAX_DESC = 36;

function shorten(text: string): string {
  if (text.length <= MAX_DESC) return text;
  return text.slice(0, MAX_DESC - 1).trimEnd() + "…";
}

export function GoalPill({ dimmed = false }: { dimmed?: boolean }) {
  const goal = useHearthStore((s) => s.profile.goal);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Hide when there's no description yet — the sample profile boots with
  // a placeholder, so we still show that. Only suppress on truly empty.
  if (!goal.description.trim()) return null;

  const short = shorten(goal.description);
  const isShortened = short !== goal.description;

  return (
    <div
      className={`fixed top-5 left-5 z-30 transition-opacity duration-700 ${
        dimmed ? "opacity-30" : "opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={() => isShortened && setPopoverOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/70 backdrop-blur border border-stone-800 text-[11px] font-mono text-stone-300 hover:border-amber-500/40 transition-colors ${
          isShortened ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={popoverOpen}
      >
        <span className="text-amber-400/80 uppercase tracking-widest text-[9px]">
          {goal.kind.replace("_", " ")}
        </span>
        <span className="text-stone-600">·</span>
        <span>{goal.durationMin}m</span>
        <span className="text-stone-600">·</span>
        <span className="text-stone-200">{short}</span>
      </button>

      <AnimatePresence>
        {popoverOpen && isShortened && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 mt-2 w-72 p-3 rounded-md bg-stone-900/95 backdrop-blur border border-stone-800 shadow-xl"
          >
            <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">
              Original goal
            </div>
            <div className="text-sm text-stone-100 leading-relaxed">
              {goal.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
