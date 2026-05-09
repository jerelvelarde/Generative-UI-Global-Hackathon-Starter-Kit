"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Mail, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import {
  EMAIL_TONES,
  type EmailDraft,
  type EmailTone,
  type Lead,
} from "@/lib/leads/types";
import { initials } from "@/lib/leads/derive";

const TONE_LABEL: Record<EmailTone, string> = {
  casual: "Casual",
  technical: "Technical",
  "founder-to-founder": "Founder-to-founder",
  "conference-followup": "Conference follow-up",
};

const TONE_BLURB: Record<EmailTone, string> = {
  casual: "Conversational, no jargon.",
  technical: "Specific to their stack.",
  "founder-to-founder": "Direct, brief.",
  "conference-followup": "References a specific moment.",
};

export interface EmailDraftReviewProps {
  lead: Pick<Lead, "id" | "name" | "email" | "company" | "role">;
  draft: EmailDraft;
  /** Approve the (possibly edited) draft. Caller queues / sends. */
  onApprove: (next: EmailDraft) => void;
  /** Ask the agent to redo the draft. */
  onRegenerate?: () => void;
  /** Drop the draft entirely. */
  onDiscard?: () => void;
  /** Switch tone — caller decides whether to round-trip to the agent. */
  onToneChange?: (tone: EmailTone) => void;
}

export function EmailDraftReview({
  lead,
  draft,
  onApprove,
  onRegenerate,
  onDiscard,
  onToneChange,
}: EmailDraftReviewProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [resolved, setResolved] = useState<"approved" | "discarded" | null>(
    null,
  );
  const draftedAtRef = useRef(draft.draftedAt);

  // If the agent regenerates, the draft prop changes — sync local edits to
  // the new draft so the user sees the new copy. We compare draftedAt (or
  // fall back to subject+body identity) to detect "this is a different
  // draft, not just a re-render with the same one".
  useEffect(() => {
    const stamp = draft.draftedAt ?? `${draft.subject}|${draft.body}`;
    if (stamp !== draftedAtRef.current) {
      draftedAtRef.current = stamp;
      setSubject(draft.subject);
      setBody(draft.body);
    }
  }, [draft.draftedAt, draft.subject, draft.body]);

  const recipient = lead.email
    ? `${lead.name} <${lead.email}>`
    : lead.name;

  if (resolved === "discarded") {
    return (
      <div className="my-2 max-w-[420px] rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        Draft discarded.
      </div>
    );
  }

  if (resolved === "approved") {
    return (
      <div className="my-2 inline-flex max-w-[420px] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="size-3" />
        Draft approved · {subject || "(no subject)"}
      </div>
    );
  }

  return (
    <motion.div
      className="my-2 w-full max-w-[440px] overflow-hidden rounded-xl border border-secondary/40 bg-card shadow-sm"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Eyebrow + recipient */}
      <header className="flex items-start gap-2 border-b border-border/60 bg-secondary/5 px-3 py-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary/15 text-[11px] font-semibold text-secondary">
          {initials(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-secondary">
            <Sparkles className="size-2.5" aria-hidden />
            Action required · Email draft
          </div>
          <div className="truncate text-[12px] font-semibold text-foreground">
            {lead.name}
            {lead.role || lead.company ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {[lead.role, lead.company].filter(Boolean).join(" @ ")}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <Mail className="size-2.5" aria-hidden />
            {recipient}
          </div>
        </div>
      </header>

      {/* Subject */}
      <div className="px-3 pt-2.5">
        <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-border bg-input px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30"
          placeholder="(no subject)"
        />
      </div>

      {/* Body */}
      <div className="px-3 pt-2.5">
        <label className="mb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Body</span>
          {draft.rationale ? (
            <span className="inline-flex items-center gap-1 normal-case tracking-normal text-secondary/80">
              <Sparkles className="size-2.5" aria-hidden />
              <span className="font-normal italic">{draft.rationale}</span>
            </span>
          ) : null}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.max(6, Math.min(14, body.split(/\n/).length + 1))}
          className="w-full resize-y rounded-md border border-border bg-input px-2 py-1.5 text-[12px] leading-relaxed text-foreground outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30"
        />
      </div>

      {/* Tone */}
      <div className="px-3 pt-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tone
        </div>
        <div className="flex flex-wrap gap-1">
          {EMAIL_TONES.map((t) => {
            const active = t === draft.tone;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToneChange?.(t)}
                title={TONE_BLURB[t]}
                disabled={!onToneChange}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${onToneChange ? "" : "cursor-default opacity-60"}`}
              >
                {TONE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-muted/20 px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            onApprove({ ...draft, subject, body });
            setResolved("approved");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Check className="size-3" />
          Approve &amp; queue
        </button>
        {onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent/10"
          >
            <RefreshCcw className="size-3" />
            Regenerate
          </button>
        ) : null}
        {onDiscard ? (
          <button
            type="button"
            onClick={() => {
              onDiscard();
              setResolved("discarded");
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3" />
            Discard
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
