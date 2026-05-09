"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Followup, Lead } from "@/lib/leads/types";

export interface FollowupListProps {
  followups: Followup[];
  leads: Lead[];
  onToggle: (id: string) => void;
  onAdd: (text: string, leadId?: string) => void;
  onRemove: (id: string) => void;
}

/**
 * The threads-demo "shared list" (A2UI) demo, adapted to the lead-form domain.
 * Both the agent and the user write to `state.followups`; this component
 * renders the live list and lets the user check off / remove / add items.
 *
 * Render slot is intentionally minimal so it works in chat-only mode AND
 * inline in the canvas. No card chrome, no lead-detail integration.
 */
export function FollowupList({
  followups,
  leads,
  onToggle,
  onAdd,
  onRemove,
}: FollowupListProps) {
  const [draft, setDraft] = useState("");
  const leadName = (id?: string) =>
    id ? leads.find((l) => l.id === id)?.name ?? "" : "";

  return (
    <div className="my-2 max-w-[460px] rounded-xl border border-[#DBDBE5] bg-white p-3 text-sm shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Follow-ups
        </span>
        <span className="text-[11px] text-muted-foreground">
          {followups.filter((f) => f.status === "done").length}/
          {followups.length} done
        </span>
      </div>

      {followups.length === 0 ? (
        <p className="mb-2 text-[12px] text-muted-foreground">
          No follow-ups yet. Ask the agent to draft some, or add one below.
        </p>
      ) : (
        <ul className="mb-2 flex flex-col gap-1">
          {followups.map((f) => {
            const done = f.status === "done";
            return (
              <li
                key={f.id}
                className="group flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-[#F5F5FA]"
              >
                <button
                  aria-label={done ? "Mark pending" : "Mark done"}
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${
                    done
                      ? "border-[#85ECCE] bg-[#85ECCE] text-foreground"
                      : "border-[#DBDBE5] bg-white text-transparent hover:border-foreground"
                  }`}
                  type="button"
                  onClick={() => onToggle(f.id)}
                >
                  <Check size={10} strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[13px] ${
                      done
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {f.text}
                  </p>
                  {f.leadId && leadName(f.leadId) ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      → {leadName(f.leadId)}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Remove follow-up"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  type="button"
                  onClick={() => onRemove(f.id)}
                >
                  <X size={12} className="text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          onAdd(t);
          setDraft("");
        }}
      >
        <input
          className="flex-1 rounded-md border border-[#DBDBE5] bg-white px-2 py-1 text-[12px] outline-none placeholder:text-muted-foreground/60 focus:border-foreground"
          placeholder="Add a follow-up…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          aria-label="Add follow-up"
          className="grid size-6 shrink-0 place-items-center rounded-md border border-[#DBDBE5] bg-white text-foreground transition-colors hover:bg-[#F5F5FA]"
          type="submit"
          disabled={!draft.trim()}
        >
          <Plus size={12} />
        </button>
      </form>
    </div>
  );
}
