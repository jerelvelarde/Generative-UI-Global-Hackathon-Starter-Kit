"use client";

import { Switch } from "@/components/ui/switch";
import { Lever } from "@/lib/hearth/schema";

type LeverToggleProps = {
  lever: Lever;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
};

export function LeverToggle({ lever, value, onValueChange }: LeverToggleProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
      <span>
        <span className="block text-sm text-[#f1ecdc]">{lever.label}</span>
        {lever.description ? (
          <span className="mt-1 block text-xs text-[#b9b29f]">
            {lever.description}
          </span>
        ) : null}
      </span>
      <Switch checked={value} onCheckedChange={onValueChange} />
    </label>
  );
}

