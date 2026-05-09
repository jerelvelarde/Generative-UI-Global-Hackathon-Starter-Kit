"use client";

import { FormEvent, useMemo } from "react";
import { motion } from "motion/react";

type WelcomeScreenProps = {
  goalText: string;
  onGoalTextChange: (nextValue: string) => void;
  onSubmitGoal: (goalText: string) => void;
  isSubmitting?: boolean;
  minChars?: number;
  className?: string;
};

export function WelcomeScreen({
  goalText,
  onGoalTextChange,
  onSubmitGoal,
  isSubmitting = false,
  minChars = 10,
  className,
}: WelcomeScreenProps) {
  const canSubmit = useMemo(
    () => goalText.trim().length >= minChars && !isSubmitting,
    [goalText, isSubmitting, minChars],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmitGoal(goalText.trim());
  };

  return (
    <section
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b19] text-[#e7e4d8] ${className ?? ""}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,208,128,0.10),transparent_45%),radial-gradient(circle_at_75%_80%,rgba(120,182,255,0.14),transparent_52%)]" />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-3xl px-6"
      >
        <motion.p
          className="font-serif text-3xl leading-tight tracking-wide md:text-5xl"
          animate={{ opacity: isSubmitting ? 0.7 : 1 }}
          transition={{ duration: 0.35 }}
        >
          What are you working on?
        </motion.p>
        <motion.label
          className="mt-8 block rounded-2xl border border-white/20 bg-white/5 p-3 shadow-[0_20px_80px_rgba(5,8,16,0.4)] backdrop-blur-md"
          animate={{
            boxShadow: [
              "0 0 0 rgba(255,255,255,0.0)",
              "0 0 0 rgba(255,255,255,0.25)",
              "0 0 0 rgba(255,255,255,0.0)",
            ],
          }}
          transition={{ repeat: Infinity, duration: 3.6, ease: "easeInOut" }}
        >
          <span className="sr-only">Your work goal</span>
          <input
            value={goalText}
            onChange={(event) => onGoalTextChange(event.target.value)}
            placeholder="Debugging a flaky integration test, need 90 minutes of deep focus."
            disabled={isSubmitting}
            className="w-full bg-transparent px-3 py-4 text-base text-[#f2efe4] outline-none placeholder:text-[#c4c0b0]/70 md:text-lg"
          />
        </motion.label>
        <motion.p
          className="mt-3 font-mono text-[11px] tracking-wide text-[#bdb8a3]"
          initial={{ opacity: 0 }}
          animate={{ opacity: goalText.trim().length > 0 ? 0.8 : 0 }}
        >
          the more specific, the better the room
        </motion.p>
        <motion.button
          type="submit"
          disabled={!canSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: canSubmit ? 1 : 0,
            y: canSubmit ? 0 : 10,
            pointerEvents: canSubmit ? "auto" : "none",
          }}
          transition={{ duration: 0.25 }}
          className="mt-8 inline-flex items-center rounded-full border border-[#eadfbc]/60 bg-[#d9bd7a]/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-[#f4e8c8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Building room..." : "Begin"}
        </motion.button>
      </motion.form>
    </section>
  );
}

