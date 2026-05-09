"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Lead } from "@/lib/leads/types";
import { STATUSES } from "@/lib/leads/types";
import { groupByStatus, statusClass } from "@/lib/leads/derive";
import { LeadCard } from "./LeadCard";

interface PipelineBoardProps {
  leads: Lead[];
  selectedLeadId: string | null;
  highlightedLeadIds: string[];
  onSelect: (id: string) => void;
  /**
   * Move a lead to a different status column. Wired to `commitLeadEdit`
   * which persists back to Notion's `Status` property via `update_notion_lead`.
   */
  onMoveLead?: (leadId: string, fromStatus: string, toStatus: string) => void;
  /** Ids of leads with an in-flight Notion write. */
  syncingIds?: Set<string>;
  /** Ids of leads whose write just landed (~800ms ring flash). */
  justSyncedIds?: Set<string>;
}

export function PipelineBoard({
  leads,
  selectedLeadId,
  highlightedLeadIds,
  onSelect,
  onMoveLead,
  syncingIds,
  justSyncedIds,
}: PipelineBoardProps) {
  const groups = groupByStatus(leads);
  const highlighted = new Set(highlightedLeadIds);

  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);

  // 6px activation distance prevents the drag handler from hijacking simple
  // clicks (open lead detail) on the card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const lead = leads.find((l) => l.id === id) ?? null;
    setDraggingLead(lead);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingLead(null);
    if (!e.over || !onMoveLead) return;
    const leadId = String(e.active.id);
    const toStatus = String(e.over.id);
    const fromStatus =
      (e.active.data.current as { status?: string } | undefined)?.status ??
      leads.find((l) => l.id === leadId)?.status ??
      "Not started";
    if (fromStatus === toStatus) return;
    onMoveLead(leadId, fromStatus, toStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingLead(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-2">
        {STATUSES.map((s) => {
          const list = groups[s] ?? [];
          return (
            <DroppableColumn key={s} status={s} count={list.length}>
              {list.length === 0 ? (
                <div className="grid place-items-center py-8 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/60">
                  empty
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {list.map((lead) => (
                    <DraggableLeadCard
                      key={lead.id}
                      lead={lead}
                      selected={selectedLeadId === lead.id}
                      highlighted={highlighted.has(lead.id)}
                      highlightedLeadIds={highlightedLeadIds}
                      onClick={() => onSelect(lead.id)}
                      syncing={syncingIds?.has(lead.id) ?? false}
                      justSynced={justSyncedIds?.has(lead.id) ?? false}
                    />
                  ))}
                </AnimatePresence>
              )}
            </DroppableColumn>
          );
        })}
      </div>

      <DragOverlay>
        {draggingLead ? (
          <div className="opacity-90">
            <LeadCard lead={draggingLead} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({
  status,
  count,
  children,
}: {
  status: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`flex flex-1 min-w-72 shrink-0 flex-col rounded-xl border bg-card transition ${
        isOver
          ? "border-[#BEC2FF] ring-1 ring-[#BEC2FF] bg-[#BEC2FF1A]"
          : "border-border"
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ring-1 ring-inset ${statusClass(
              status,
            )}`}
          >
            {status}
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {children}
      </div>
    </section>
  );
}

interface DraggableLeadCardProps {
  lead: Lead;
  selected: boolean;
  highlighted: boolean;
  highlightedLeadIds: string[];
  onClick: () => void;
  syncing?: boolean;
  justSynced?: boolean;
}

function DraggableLeadCard({
  lead,
  selected,
  highlighted,
  highlightedLeadIds,
  onClick,
  syncing,
  justSynced,
}: DraggableLeadCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });
  // Scroll into view whenever this card transitions into the selected
  // state — that's the signal "Open in canvas" sends from the chat-side
  // LeadMiniCard. Without it, selection is a faint ring on a card that
  // may be in another column or scrolled below the fold.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selected) return;
    const node = containerRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected]);
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        containerRef.current = node;
      }}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0 : 1 }}
    >
      <LeadCard
        lead={lead}
        selected={selected}
        highlighted={highlighted}
        highlightedLeadIds={highlightedLeadIds}
        onClick={onClick}
        syncing={syncing}
        justSynced={justSynced}
      />
    </div>
  );
}
