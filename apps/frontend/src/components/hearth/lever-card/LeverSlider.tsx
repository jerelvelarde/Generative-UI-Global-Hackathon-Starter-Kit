"use client";

import { Slider } from "@/components/ui/slider";
import { Lever } from "@/lib/hearth/schema";

type LeverSliderProps = {
  lever: Lever;
  value: number;
  onValueChange: (nextValue: number) => void;
};

export function LeverSlider({ lever, value, onValueChange }: LeverSliderProps) {
  if (!lever.range) return null;

  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#f1ecdc]">{lever.label}</span>
        <span className="font-mono text-[11px] text-[#d2ccb6]">
          {Number.isFinite(value) ? value.toFixed(lever.range.step ? 2 : 0) : "--"}
        </span>
      </div>
      <Slider
        value={[value]}
        min={lever.range.min}
        max={lever.range.max}
        step={lever.range.step}
        onValueChange={(next) => onValueChange(next[0] ?? lever.range!.default)}
      />
      {lever.description ? (
        <p className="text-xs text-[#b9b29f]">{lever.description}</p>
      ) : null}
    </label>
  );
}

