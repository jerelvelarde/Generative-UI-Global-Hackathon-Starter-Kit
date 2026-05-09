"use client";

import { AnimatePresence, motion } from "motion/react";
import { Lever } from "@/lib/hearth/schema";
import { LeverSegmented } from "@/components/hearth/lever-card/LeverSegmented";
import { LeverSlider } from "@/components/hearth/lever-card/LeverSlider";
import { LeverToggle } from "@/components/hearth/lever-card/LeverToggle";

export type LeverValue = number | string | boolean;
export type LeverValueMap = Record<string, LeverValue | undefined>;

type LeverCardProps = {
  title: string;
  note?: string;
  levers: Lever[];
  values: LeverValueMap;
  transitionKey: string;
  onValueChange: (lever: Lever, nextValue: LeverValue) => void;
  className?: string;
};

export function LeverCard({
  title,
  note,
  levers,
  values,
  transitionKey,
  onValueChange,
  className,
}: LeverCardProps) {
  return (
    <aside
      className={`w-full rounded-3xl border border-white/20 bg-[#100f16]/72 p-5 text-[#f3efdf] shadow-[0_24px_80px_rgba(6,8,16,0.45)] backdrop-blur-xl ${className ?? ""}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#e7d7af]">
        {title}
      </p>
      {note ? <p className="mt-2 text-sm text-[#c9c2ac]">{note}</p> : null}
      <AnimatePresence mode="wait">
        <motion.div
          key={transitionKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className="mt-4 space-y-3"
        >
          {levers.map((lever, index) => (
            <motion.div
              key={lever.id}
              initial={{ opacity: 0, scaleY: 0.75, y: 12 }}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={{ opacity: 0, scaleY: 0.3, y: -16 }}
              transition={{
                duration: 0.32,
                delay: index * 0.08,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: "top" }}
              className="rounded-2xl border border-white/10 bg-black/20 p-3"
            >
              <LeverControl
                lever={lever}
                value={resolveValue(lever, values[lever.id])}
                onValueChange={(nextValue) => onValueChange(lever, nextValue)}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

type LeverControlProps = {
  lever: Lever;
  value: LeverValue;
  onValueChange: (nextValue: LeverValue) => void;
};

function LeverControl({ lever, value, onValueChange }: LeverControlProps) {
  if (lever.kind === "slider") {
    const numberValue = typeof value === "number" ? value : lever.range?.default ?? 0;
    return (
      <LeverSlider
        lever={lever}
        value={numberValue}
        onValueChange={(nextValue) => onValueChange(nextValue)}
      />
    );
  }

  if (lever.kind === "segmented") {
    const options = lever.options ?? [];
    const fallback = options[0]?.value ?? "";
    const stringValue = typeof value === "string" ? value : fallback;
    return (
      <LeverSegmented
        lever={lever}
        value={stringValue}
        onValueChange={(nextValue) => onValueChange(nextValue)}
      />
    );
  }

  const boolValue = typeof value === "boolean" ? value : false;
  return (
    <LeverToggle
      lever={lever}
      value={boolValue}
      onValueChange={(nextValue) => onValueChange(nextValue)}
    />
  );
}

function resolveValue(lever: Lever, value: LeverValue | undefined): LeverValue {
  if (value !== undefined) return value;
  if (lever.kind === "slider") return lever.range?.default ?? 0;
  if (lever.kind === "segmented") return lever.options?.[0]?.value ?? "";
  return false;
}

