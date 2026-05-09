"use client";

import Link from "next/link";
import { MessageCircle, RefreshCw } from "lucide-react";
import type { SyncMeta } from "@/lib/leads/types";

interface HeaderProps {
  title: string;
  subtitle: string;
  totalLeads: number;
  visibleLeads: number;
  sync: SyncMeta;
}

export function Header({
  title,
  subtitle,
  totalLeads,
  visibleLeads,
  sync,
}: HeaderProps) {
  const isLocalMode = sync.databaseTitle?.startsWith("Local:") ?? false;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        <Link
          aria-label="Back to chat-only mode"
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#DBDBE5] bg-white px-2 py-1 normal-case tracking-normal text-foreground transition-colors hover:bg-[#F5F5FA]"
        >
          <MessageCircle size={12} />
          <span>Chat only</span>
        </Link>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{visibleLeads}</span>
          {visibleLeads !== totalLeads ? (
            <span className="text-muted-foreground"> / {totalLeads}</span>
          ) : null}{" "}
          leads
        </span>
        {sync.databaseTitle ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-muted-foreground/50" />
            <span className="normal-case tracking-normal">
              {isLocalMode
                ? sync.databaseTitle
                : `Notion: ${sync.databaseTitle}`}
            </span>
          </span>
        ) : null}
        {sync.syncedAt ? (
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="size-3" />
            {formatRelative(sync.syncedAt)}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function formatRelative(iso: string): string {
  try {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return "synced";
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "synced";
  }
}
