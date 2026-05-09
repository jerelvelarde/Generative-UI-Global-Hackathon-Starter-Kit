"use client";

import { motion } from "motion/react";
import type { Lead } from "@/lib/leads/types";
import { workshopDemand } from "@/lib/leads/derive";

interface WorkshopSpreadProps {
  leads: Lead[];
}

const WORKSHOP_BG: Record<string, string> = {
  "Agentic UI (AG-UI)": "bg-violet-500",
  "MCP Apps / Tooling": "bg-sky-500",
  "RAG & Data Chat": "bg-emerald-500",
  "Evaluations & Guardrails": "bg-amber-500",
  "Deploying Agents (prod)": "bg-indigo-500",
  "Not sure yet": "bg-slate-400",
};

export function WorkshopSpread({ leads }: WorkshopSpreadProps) {
  const rows = workshopDemand(leads).filter((r) => r.count > 0);
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded bg-muted">
      {rows.map((r) => {
        const pct = (r.count / total) * 100;
        return (
          <motion.span
            key={r.label}
            className={WORKSHOP_BG[r.label] ?? "bg-slate-400"}
            title={`${r.label} · ${r.count}`}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
