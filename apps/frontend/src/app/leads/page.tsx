"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Toaster, toast } from "sonner";
import {
  CopilotChatConfigurationProvider,
  CopilotSidebar,
  useAgent,
  useConfigureSuggestions,
  useCopilotKit,
  useDefaultRenderTool,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { ThreadsDrawer } from "@/components/threads-drawer";
import drawerStyles from "@/components/threads-drawer/threads-drawer.module.css";

import type { AgentState, Lead, LeadFilter } from "@/lib/leads/types";
import { initialState, emptyFilter } from "@/lib/leads/state";
import { applyFilter } from "@/lib/leads/derive";
import { applyPatch, revertPatch } from "@/lib/leads/optimistic";

import { Header } from "@/components/leads/Header";
import { PipelineBoard } from "@/components/leads/PipelineBoard";
import { QuickStats } from "@/components/leads/QuickStats";
import { StatusDonut } from "@/components/leads/StatusDonut";
import { WorkshopDemand } from "@/components/leads/WorkshopDemand";
import { LeadMiniCard } from "@/components/leads/inline/LeadMiniCard";
import { EmailDraftCard } from "@/components/leads/inline/EmailDraftCard";
import { ToolFallbackCard } from "@/components/copilot/ToolFallbackCard";

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

const leadShape = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string(),
  company: z.string().default(""),
  email: z.string().default(""),
  role: z.string().default(""),
  phone: z.string().optional(),
  source: z.string().optional(),
  technical_level: z.string().default(""),
  interested_in: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  workshop: z.string().default("Not sure yet"),
  status: z.string().default("Not started"),
  opt_in: z.boolean().default(false),
  message: z.string().default(""),
  submitted_at: z.string().default(""),
});

// Merge raw agent state into the canonical AgentState shape so consumers can
// rely on every nested field existing (filter, header, sync, etc.).
function mergeAgentState(raw: unknown): AgentState {
  const partial =
    raw && typeof raw === "object" ? (raw as Partial<AgentState>) : {};
  return {
    ...initialState,
    ...partial,
    filter: { ...initialState.filter, ...(partial.filter ?? {}) },
    header: { ...initialState.header, ...(partial.header ?? {}) },
    sync: { ...initialState.sync, ...(partial.sync ?? {}) },
    leads: partial.leads ?? initialState.leads,
    highlightedLeadIds:
      partial.highlightedLeadIds ?? initialState.highlightedLeadIds,
  };
}

// v2 `useFrontendTool({ render })` registers the closure once and never
// updates it, so any render that captures `agent.state` directly is stuck
// with the first-mount value. The fix: keep registered renderers as
// `() => <LiveX />` factories and have the wrapper subscribe to agent state
// itself via `useAgent()`. `useAgent` re-renders on `OnStateChanged`, giving
// us fresh state each time without closure capture.
function useLiveAgentState() {
  const { agent } = useAgent();
  const state = mergeAgentState(agent?.state);
  const setState = (updater: (prev: AgentState) => AgentState) => {
    agent?.setState(updater(mergeAgentState(agent?.state)));
  };
  return { agent, state, setState };
}

function LiveWorkshopDemand() {
  const { state, setState } = useLiveAgentState();
  return (
    <div className="my-2">
      <WorkshopDemand
        leads={state.leads}
        selectedWorkshops={state.filter.workshops}
        compact
        onPickWorkshop={(w) =>
          setState((prev) => {
            const has = prev.filter.workshops.includes(w);
            return {
              ...prev,
              filter: {
                ...prev.filter,
                workshops: has
                  ? prev.filter.workshops.filter((x) => x !== w)
                  : [...prev.filter.workshops, w],
              },
            };
          })
        }
      />
    </div>
  );
}

function CanvasInner() {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();

  useConfigureSuggestions({
    available: "before-first-message",
    suggestions: [
      {
        title: "Import from Notion",
        message: "Import the leads from Notion.",
      },
      {
        title: "What's hot?",
        message: "What workshops are most in demand right now?",
      },
      {
        title: "Highlight developers",
        message:
          "Highlight every lead with technical_level Developer or Advanced / expert.",
      },
      {
        title: "Profile a lead",
        message: "Tell me about Ada Lovelace and show her mini card.",
      },
    ],
  });

  // Round-trip a synthetic user message + run the agent. Used to ask the
  // agent to persist optimistic edits via its Notion tools.
  const injectPrompt = useCallback(
    (prompt: string) => {
      if (!agent) return;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `msg-${Date.now()}`;
      agent.addMessage({ id, role: "user", content: prompt });
      void copilotkit.runAgent({ agent }).catch((error: unknown) => {
        console.error("injectPrompt: runAgent failed", error);
        let hint: string | undefined;
        if (error && typeof error === "object") {
          const anyErr = error as Record<string, unknown>;
          if (typeof anyErr.hint === "string") {
            hint = anyErr.hint;
          } else if (typeof anyErr.message === "string") {
            try {
              const parsed = JSON.parse(anyErr.message);
              if (parsed && typeof parsed.hint === "string") hint = parsed.hint;
            } catch {
              /* not JSON */
            }
          }
        }
        if (hint) toast.error(hint, { duration: 8000 });
      });
    },
    [agent, copilotkit],
  );

  // Optimistic write tracking — snapshot per leadId for rollback, plus two
  // sets of ids for the spinner overlay and the post-write green flash.
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [justSyncedIds, setJustSyncedIds] = useState<Set<string>>(new Set());
  const snapshotsRef = useRef<Map<string, Lead>>(new Map());
  const processedToolMsgIds = useRef<Set<string>>(new Set());
  const justSyncedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const flashJustSynced = useCallback((id: string) => {
    setJustSyncedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const existing = justSyncedTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setJustSyncedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      justSyncedTimers.current.delete(id);
    }, 800);
    justSyncedTimers.current.set(id, t);
  }, []);

  useEffect(() => {
    return () => {
      for (const t of justSyncedTimers.current.values()) clearTimeout(t);
      justSyncedTimers.current.clear();
    };
  }, []);

  const state = mergeAgentState(agent?.state);

  const updateState = useCallback(
    (updater: (prev: AgentState) => AgentState) => {
      agent?.setState(updater(mergeAgentState(agent?.state)));
    },
    [agent],
  );

  // ----- State-mutator frontend tools ------------------------------------

  useFrontendTool({
    name: "setHeader",
    description:
      "Set the workspace header (title and subtitle shown above the canvas).",
    parameters: z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
    }),
    handler: async ({ title, subtitle }) => {
      updateState((prev) => ({
        ...prev,
        header: {
          title: title ?? prev.header.title,
          subtitle: subtitle ?? prev.header.subtitle,
        },
      }));
      return "header updated";
    },
  });

  useFrontendTool({
    name: "setLeads",
    description:
      "Replace the entire lead list. Call this once after fetching from Notion.",
    parameters: z.object({ leads: z.array(leadShape) }),
    handler: async ({ leads }) => {
      const list = leads as Lead[];
      updateState((prev) => ({
        ...prev,
        leads: list,
        highlightedLeadIds: prev.highlightedLeadIds.filter((id) =>
          list.some((l) => l.id === id),
        ),
        selectedLeadId:
          prev.selectedLeadId &&
          list.some((l) => l.id === prev.selectedLeadId)
            ? prev.selectedLeadId
            : null,
      }));
      return `loaded ${leads.length} leads`;
    },
  });

  useFrontendTool({
    name: "setSyncMeta",
    description:
      "Record which Notion database is the canvas's source of truth and when we last synced.",
    parameters: z.object({
      databaseId: z.string().optional(),
      databaseTitle: z.string().optional(),
      syncedAt: z.string().optional(),
    }),
    handler: async ({ databaseId, databaseTitle, syncedAt }) => {
      updateState((prev) => ({
        ...prev,
        sync: {
          databaseId: databaseId ?? prev.sync.databaseId,
          databaseTitle: databaseTitle ?? prev.sync.databaseTitle,
          syncedAt: syncedAt ?? new Date().toISOString(),
        },
      }));
      return "sync meta updated";
    },
  });

  useFrontendTool({
    name: "setFilter",
    description:
      "Narrow the visible leads. Pass any subset of fields; omitted fields are kept.",
    parameters: z.object({
      workshops: z.array(z.string()).optional(),
      technical_levels: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
      opt_in: z.enum(["any", "yes", "no"]).optional(),
      search: z.string().optional(),
    }),
    handler: async (patch) => {
      updateState((prev) => ({
        ...prev,
        filter: { ...prev.filter, ...(patch as Partial<LeadFilter>) },
      }));
      return "filter updated";
    },
  });

  useFrontendTool({
    name: "clearFilters",
    description: "Reset all filters to show every loaded lead.",
    parameters: z.object({}),
    handler: async () => {
      updateState((prev) => ({ ...prev, filter: emptyFilter }));
      return "filters cleared";
    },
  });

  useFrontendTool({
    name: "highlightLeads",
    description:
      "Visually highlight specific leads. Pass an empty array to clear highlights.",
    parameters: z.object({ leadIds: z.array(z.string()) }),
    handler: async ({ leadIds }) => {
      updateState((prev) => ({ ...prev, highlightedLeadIds: leadIds }));
      return `highlighted ${leadIds.length} leads`;
    },
  });

  useFrontendTool({
    name: "selectLead",
    description: "Open the detail panel for one lead. Pass null to deselect.",
    parameters: z.object({ leadId: z.string().nullable() }),
    handler: async ({ leadId }) => {
      updateState((prev) => ({ ...prev, selectedLeadId: leadId }));
      return leadId ? `selected ${leadId}` : "selection cleared";
    },
  });

  // Optimistic write: snapshot → apply patch → ask agent to persist.
  // The ToolMessage observer below resolves or reverts.
  const commitLeadEdit = useCallback(
    (leadId: string, patch: Partial<Lead>) => {
      const snap = mergeAgentState(agent?.state).leads.find(
        (l) => l.id === leadId,
      );
      if (!snap) return;
      snapshotsRef.current.set(leadId, snap);
      setSyncingIds((prev) => {
        if (prev.has(leadId)) return prev;
        const next = new Set(prev);
        next.add(leadId);
        return next;
      });
      updateState((prev) => applyPatch(prev, leadId, patch));
      injectPrompt(`Update lead ${leadId} in Notion: ${JSON.stringify(patch)}`);
    },
    [agent, updateState, injectPrompt],
  );

  useFrontendTool({
    name: "commitLeadEdit",
    description:
      "Commit an edit to a single lead with optimistic UI. Asks the agent to persist via update_notion_lead. The patch is a partial Lead — only include fields that change.",
    parameters: z.object({
      leadId: z.string(),
      patch: z
        .object({
          name: z.string().optional(),
          company: z.string().optional(),
          email: z.string().optional(),
          role: z.string().optional(),
          phone: z.string().optional(),
          source: z.string().optional(),
          technical_level: z.string().optional(),
          interested_in: z.array(z.string()).optional(),
          tools: z.array(z.string()).optional(),
          workshop: z.string().optional(),
          status: z.string().optional(),
          opt_in: z.boolean().optional(),
          message: z.string().optional(),
        })
        .passthrough(),
    }),
    handler: async ({ leadId, patch }) => {
      const lead = mergeAgentState(agent?.state).leads.find(
        (l) => l.id === leadId,
      );
      commitLeadEdit(leadId, patch as Partial<Lead>);
      return `queued: editing ${lead?.name ?? leadId}`;
    },
  });

  // Watch the tail of agent.messages for tool replies that confirm or reject
  // pending optimistic writes. Notion writers reply "Updated " / "Added " on
  // success, "Update failed" / "Insert failed" on failure.
  const messageTail =
    (
      agent?.messages as Array<{
        id?: string;
        role?: string;
        content?: unknown;
      }>
    )?.slice(-10) ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!agent || !messageTail.length) return;
    for (const m of messageTail) {
      const id = m.id;
      if (!id || m.role !== "tool") continue;
      if (processedToolMsgIds.current.has(id)) continue;
      processedToolMsgIds.current.add(id);

      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((b) =>
                  typeof b === "string"
                    ? b
                    : (b as { text?: string })?.text ?? "",
                )
                .join("")
            : "";
      if (!content) continue;

      const isFailure =
        content.startsWith("Update failed") ||
        content.startsWith("Insert failed");
      const isSuccess =
        content.startsWith("Updated ") || content.startsWith("Added ");
      if (!isFailure && !isSuccess) continue;

      const pending = Array.from(snapshotsRef.current.entries());
      if (pending.length === 0) continue;

      if (isSuccess) {
        const [leadId] = pending[pending.length - 1];
        snapshotsRef.current.delete(leadId);
        setSyncingIds((prev) => {
          if (!prev.has(leadId)) return prev;
          const next = new Set(prev);
          next.delete(leadId);
          return next;
        });
        flashJustSynced(leadId);
      } else {
        const reverted: Lead[] = [];
        updateState((prev) => {
          let next = prev;
          for (const [, snap] of pending) {
            next = revertPatch(next, snap);
            reverted.push(snap);
          }
          return next;
        });
        snapshotsRef.current.clear();
        setSyncingIds(new Set());
        toast.error(
          reverted.length === 1
            ? `Couldn't sync ${reverted[0].name} to Notion — change reverted.`
            : `Couldn't sync ${reverted.length} leads to Notion — changes reverted.`,
          { duration: 5000 },
        );
      }
    }
  }, [messageTail.map((m) => m.id).join(","), agent, flashJustSynced]);

  // ----- Controlled gen UI: named renderers ------------------------------

  useFrontendTool({
    name: "renderLeadMiniCard",
    description:
      "Render an inline lead-mini-card in the chat when mentioning a specific lead by name. Pass leadId plus as much of name/role/company/email/workshop/technical_level as you have.",
    parameters: z.object({
      leadId: z.string(),
      name: z.string().optional(),
      role: z.string().optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      workshop: z.string().optional(),
      technical_level: z.string().optional(),
    }),
    render: ({ args }) => (
      <LeadMiniCard
        leadId={args.leadId}
        name={args.name}
        role={args.role}
        company={args.company}
        email={args.email}
        workshop={args.workshop}
        technical_level={args.technical_level}
        // "Open in canvas" needs to be visibly different from the persistent
        // selection ring. Clear any filter that hides the lead, set it as
        // both selected (ring) and highlighted (2s pulse via usePulse), and
        // let PipelineBoard scroll it into view.
        onSelect={(id) =>
          updateState((prev) => ({
            ...prev,
            filter: emptyFilter,
            selectedLeadId: id,
            highlightedLeadIds: [id],
          }))
        }
      />
    ),
  });

  useFrontendTool({
    name: "renderWorkshopDemand",
    description:
      "Render an inline horizontal bar chart of leads-per-workshop. Reads live agent state, takes no args.",
    parameters: z.object({}),
    render: () => <LiveWorkshopDemand />,
  });

  // HITL email draft. Agent supplies leadId + subject + body. The user can
  // edit the fields in chat, then click Send — which fires post_lead_comment
  // through injectPrompt so the agent persists it as a Notion comment.
  useFrontendTool({
    name: "renderEmailDraft",
    description:
      "Render a human-in-the-loop email draft inline in chat. Use this AFTER finding the lead and BEFORE posting any comment — the user must approve, edit, or discard the draft. On Send, the canvas will round-trip a post_lead_comment call back to the agent. Do NOT call post_lead_comment in the same turn — wait for the user.",
    parameters: z.object({
      leadId: z.string(),
      leadName: z.string().optional(),
      leadEmail: z.string().optional(),
      subject: z.string(),
      body: z.string(),
    }),
    render: ({ args }) => {
      if (!args.leadId || !args.subject || !args.body) {
        return (
          <div className="my-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-[#BEC2FF]" />
            <span className="font-mono">Drafting email…</span>
          </div>
        );
      }
      const leadId = args.leadId;
      return (
        <EmailDraftCard
          leadId={leadId}
          leadName={args.leadName}
          leadEmail={args.leadEmail}
          initialSubject={args.subject}
          initialBody={args.body}
          onSend={(final) =>
            injectPrompt(
              `The user approved the email draft for lead ${leadId}. Post it as a Notion comment by calling post_lead_comment with leadId=${JSON.stringify(leadId)}, subject=${JSON.stringify(final.subject)}, body=${JSON.stringify(final.body)}. Do not modify the wording.`,
            )
          }
          onRegenerate={() =>
            injectPrompt(
              `Regenerate the outreach email draft for lead ${leadId} and call renderEmailDraft again with the new version.`,
            )
          }
        />
      );
    },
  });

  // Catch-all: any tool call without a dedicated render lands here. Notion
  // MCP tools (notion_query_database, etc.) and ad-hoc backend tools surface
  // as a small CopilotKit-branded card so the user can see what's happening.
  useDefaultRenderTool({
    render: ({ name, status, result, parameters }) => (
      <ToolFallbackCard
        name={name}
        status={status}
        result={result}
        parameters={parameters}
      />
    ),
  });

  // ----- Render ----------------------------------------------------------

  const visibleLeads = useMemo(
    () => applyFilter(state.leads, state.filter),
    [state.leads, state.filter],
  );

  const handleSelect = (id: string) =>
    updateState((prev) => ({
      ...prev,
      selectedLeadId: prev.selectedLeadId === id ? null : id,
    }));

  // Drag-drop on the pipeline board moves a lead between status columns,
  // routed through commitLeadEdit so it persists to Notion.
  const handleMoveLead = (
    leadId: string,
    _fromStatus: string,
    toStatus: string,
  ) => commitLeadEdit(leadId, { status: toStatus });

  const handlePickWorkshop = (w: string) =>
    updateState((prev) => {
      const has = prev.filter.workshops.includes(w);
      return {
        ...prev,
        filter: {
          ...prev.filter,
          workshops: has
            ? prev.filter.workshops.filter((x) => x !== w)
            : [...prev.filter.workshops, w],
        },
      };
    });

  return (
    <>
      <main className="flex h-screen flex-col gap-5 overflow-hidden bg-background px-6 py-6">
        <Header
          title={state.header.title}
          subtitle={state.header.subtitle}
          totalLeads={state.leads.length}
          visibleLeads={visibleLeads.length}
          sync={state.sync}
        />

        {state.leads.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Ask the assistant to{" "}
              <span className="font-mono text-foreground">
                pull workshop signups from Notion
              </span>{" "}
              to populate the canvas.
            </p>
          </div>
        ) : (
          <>
            <QuickStats leads={state.leads} />
            <div className="grid gap-3 md:grid-cols-2">
              <StatusDonut leads={state.leads} />
              <WorkshopDemand
                leads={state.leads}
                selectedWorkshops={state.filter.workshops}
                onPickWorkshop={handlePickWorkshop}
                compact
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <PipelineBoard
                leads={visibleLeads}
                selectedLeadId={state.selectedLeadId}
                highlightedLeadIds={state.highlightedLeadIds}
                onSelect={handleSelect}
                onMoveLead={handleMoveLead}
                syncingIds={syncingIds}
                justSyncedIds={justSyncedIds}
              />
            </div>
          </>
        )}
      </main>

      <CopilotSidebar
        defaultOpen
        width={420}
        input={{ disclaimer: () => null, className: "pb-6" }}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            error: "!bg-rose-50 !text-rose-900 !border !border-rose-200",
          },
        }}
      />
    </>
  );
}

function HomePage() {
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  return (
    <div className={drawerStyles.layout}>
      <ThreadsDrawer
        agentId="default"
        threadId={threadId}
        onThreadChange={setThreadId}
      />
      <div className={drawerStyles.mainPanel}>
        <CopilotChatConfigurationProvider agentId="default" threadId={threadId}>
          <CanvasInner />
        </CopilotChatConfigurationProvider>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ClientOnly>
      <HomePage />
    </ClientOnly>
  );
}
