"use client";

import { Check, Loader2, Wrench } from "lucide-react";
import { useMemo } from "react";

export interface ToolFallbackCardProps {
  name: string;
  status: string;
  result?: string | undefined;
  parameters?: unknown;
}

/**
 * Open Generative UI catch-all renderer (the threads-demo "ToolReasoning"
 * pattern, ported). Any tool the agent invokes that doesn't have a
 * dedicated render slot lands here — backend Notion calls, health checks,
 * planner dispatches, anything new the user adds.
 *
 * Native <details> collapsible so it's keyboard accessible and degrades
 * cleanly. The card renders running / complete states with distinct
 * iconography (spinning wrench → green check) so the user can see at a
 * glance what the agent is doing.
 */
export function ToolFallbackCard({
  name,
  status,
  result,
  parameters,
}: ToolFallbackCardProps) {
  const isRunning = status === "executing" || status === "inProgress";
  const isComplete = status === "complete";

  const payload = useMemo(() => {
    const value = isComplete ? result ?? parameters : parameters;
    if (value === undefined || value === null) return "";
    if (typeof value === "string") {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [isComplete, parameters, result]);

  return (
    <details
      className="group my-2 max-w-[460px] rounded-xl border border-[#DBDBE5] bg-white text-sm shadow-sm"
      // Auto-open while running so the user can see what the agent is doing
      open={isRunning}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full ${
            isComplete
              ? "bg-[#85ECCE] text-foreground"
              : "bg-[#EDEDF5] text-muted-foreground"
          }`}
          aria-hidden
        >
          {isComplete ? (
            <Check size={11} strokeWidth={3} />
          ) : isRunning ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Wrench size={11} />
          )}
        </span>
        <span className="truncate font-mono text-[12px] text-foreground">
          {name}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {isComplete ? "done" : isRunning ? "running" : status}
        </span>
      </summary>
      {payload ? (
        <div className="border-t border-[#EDEDF5] px-3 py-2">
          <pre className="max-h-48 overflow-auto rounded-md bg-[#F7F7F9] p-2 font-mono text-[11px] leading-snug text-foreground">
            {payload}
          </pre>
        </div>
      ) : null}
    </details>
  );
}
