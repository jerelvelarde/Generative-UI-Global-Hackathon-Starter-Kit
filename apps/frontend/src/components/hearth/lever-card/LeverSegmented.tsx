"use client";

import { Lever } from "@/lib/hearth/schema";

type LeverSegmentedProps = {
  lever: Lever;
  value: string;
  onValueChange: (nextValue: string) => void;
};

export function LeverSegmented({
  lever,
  value,
  onValueChange,
}: LeverSegmentedProps) {
  if (!lever.options?.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-[#f1ecdc]">{lever.label}</p>
      <div className="inline-flex rounded-full border border-white/15 bg-black/20 p-1">
        {lever.options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onValueChange(option.value)}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition ${
                isActive
                  ? "bg-[#dcc897] text-[#2a210f]"
                  : "text-[#d8d2bf] hover:text-[#f5eed8]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {lever.description ? (
        <p className="text-xs text-[#b9b29f]">{lever.description}</p>
      ) : null}
    </div>
  );
}

