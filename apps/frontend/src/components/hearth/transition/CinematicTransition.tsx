"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

type CinematicTransitionProps = {
  goalText: string;
  isProfileReady: boolean;
  onComplete: () => void;
  preview?: ReactNode;
  durationMs?: number;
  maxHoldMs?: number;
  className?: string;
};

export function CinematicTransition({
  goalText,
  isProfileReady,
  onComplete,
  preview,
  durationMs = 8_000,
  maxHoldMs = 15_000,
  className,
}: CinematicTransitionProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 40);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (finishedRef.current) return;
    const baselineReached = elapsedMs >= durationMs;
    const hardTimeoutReached = elapsedMs >= maxHoldMs;
    if (baselineReached && (isProfileReady || hardTimeoutReached)) {
      finishedRef.current = true;
      onComplete();
    }
  }, [durationMs, elapsedMs, isProfileReady, maxHoldMs, onComplete]);

  const progress = useMemo(
    () => Math.max(0, Math.min(1, elapsedMs / durationMs)),
    [durationMs, elapsedMs],
  );
  const holdVisible = elapsedMs >= durationMs && !isProfileReady;

  return (
    <section
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b19] ${className ?? ""}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_24%,rgba(255,214,144,0.24),transparent_50%),radial-gradient(circle_at_15%_80%,rgba(109,148,255,0.22),transparent_48%)]" />
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: progress > 0.48 ? 1 : 0 }}
        transition={{ duration: 1.2 }}
      >
        {preview}
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: 0.55 - progress * 0.45 }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-8 text-center">
        <motion.p
          className="font-serif text-3xl leading-tight text-[#f0ecdd] md:text-5xl"
          style={{
            filter: `blur(${Math.max(0, Math.min(10, progress * 12))}px)`,
          }}
          animate={{
            opacity: 1 - progress * 0.7,
            y: -progress * 30,
          }}
          transition={{ ease: "linear" }}
        >
          {goalText}
        </motion.p>
        <motion.p
          className="mt-7 font-mono text-[11px] uppercase tracking-[0.22em] text-[#d9d3bd]"
          initial={{ opacity: 0 }}
          animate={{ opacity: progress > 0.12 ? 1 : 0 }}
        >
          Mood Architect engaged
        </motion.p>
        <motion.div
          className="mt-8 h-10 w-10 rounded-full border border-[#f6e3b6]/55"
          animate={{
            opacity: holdVisible ? [0.35, 1, 0.35] : 0,
            scale: holdVisible ? [0.95, 1.12, 0.95] : 1,
          }}
          transition={{
            duration: 1.1,
            repeat: holdVisible ? Infinity : 0,
            ease: "easeInOut",
          }}
        />
        <motion.p
          className="mt-6 font-mono text-xs text-[#efe6cf]"
          initial={{ opacity: 0 }}
          animate={{ opacity: progress > 0.75 ? 0.92 : 0 }}
        >
          {holdVisible
            ? "Calibrating profile..."
            : "deep focus · 90 min · debugging"}
        </motion.p>
      </div>
    </section>
  );
}

