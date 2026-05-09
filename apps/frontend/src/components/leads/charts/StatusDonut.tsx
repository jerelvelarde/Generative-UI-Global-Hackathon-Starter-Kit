"use client";

import { motion } from "motion/react";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import { STATUSES } from "@/lib/leads/types";
import { groupByStatus } from "@/lib/leads/derive";

interface StatusDonutProps {
  leads: Lead[];
  size?: number;
}

const STATUS_COLOR: Record<LeadStatus, string> = {
  "Not started": "#94a3b8",
  "In progress": "#f59e0b",
  Done: "#10b981",
};

export function StatusDonut({ leads, size = 72 }: StatusDonutProps) {
  const groups = groupByStatus(leads);
  const total = leads.length;
  const center = size / 2;
  const radius = size * 0.4;
  const stroke = size * 0.18;

  let cursor = -Math.PI / 2;
  const slices = STATUSES.map((status) => {
    const value = groups[status]?.length ?? 0;
    const fraction = total === 0 ? 0 : value / total;
    const startAngle = cursor;
    const endAngle = cursor + fraction * 2 * Math.PI;
    cursor = endAngle;
    return { status, value, fraction, startAngle, endAngle };
  });

  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${total} leads, split by pipeline status`}
        className="shrink-0"
      >
        {total === 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
            strokeDasharray="2 2"
          />
        ) : (
          slices.map((slice) =>
            slice.fraction === 0 ? null : (
              <motion.path
                key={slice.status}
                d={arcPath(
                  center,
                  center,
                  radius,
                  slice.startAngle,
                  slice.endAngle,
                )}
                fill="none"
                stroke={STATUS_COLOR[slice.status]}
                strokeWidth={stroke}
                strokeLinecap="butt"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            ),
          )
        )}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[15px] font-semibold tabular-nums"
        >
          {total}
        </text>
      </svg>
      <ul className="flex min-w-0 flex-col gap-0.5 text-[10px]">
        {STATUSES.map((status) => {
          const value = groups[status]?.length ?? 0;
          return (
            <li
              key={status}
              className="flex items-center gap-1.5 text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[status] }}
              />
              <span className="truncate">{status}</span>
              <span className="ml-auto pl-1 font-medium tabular-nums text-foreground">
                {value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${fmt(start[0])} ${fmt(start[1])} A ${fmt(r)} ${fmt(r)} 0 ${largeArc} 1 ${fmt(end[0])} ${fmt(end[1])}`;
}

function polar(
  cx: number,
  cy: number,
  r: number,
  angle: number,
): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function fmt(n: number): string {
  return n.toFixed(2);
}
