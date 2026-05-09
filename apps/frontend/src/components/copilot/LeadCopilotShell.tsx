"use client";

/**
 * LeadCopilotShell — single source of truth for the lead-form Copilot
 * surface. Both routes (`/` for chat-only, `/leads` for app mode) render
 * this component; the `mode` prop swaps the visible chrome only. Frontend
 * tools, suggestions, and the open-gen-UI fallback are registered here
 * exactly once per page so the agent has the same surface in both modes.
 *
 * The component lives inside CopilotChatConfigurationProvider but the
 * threads drawer is rendered in the route file (it owns the threadId).
 *
 * Durability: every time `agent.state.leads` changes to a non-empty list,
 * we persist a snapshot to localStorage. On mount of any thread whose
 * `agent.state.leads` is empty, we hydrate from the cache so users don't
 * have to re-import after starting a new chat. Notion stays the source of
 * truth for explicit refreshes — this is just a no-flash startup cache.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Toaster, toast } from "sonner";
import {
  CopilotChat,
  CopilotSidebar,
  useAgent,
  useConfigureSuggestions,
  useCopilotKit,
  useDefaultRenderTool,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { LayoutDashboard, MessageCircle } from "lucide-react";

import type {
  AgentState,
  Followup,
  Lead,
  LeadFilter,
} from "@/lib/leads/types";
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
import { FollowupList } from "@/components/leads/inline/FollowupList";
import { ToolFallbackCard } from "@/components/copilot/ToolFallbackCard";

const LEADS_CACHE_KEY = "lead-form:cached-leads/v1";

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

const followupShape = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["pending", "done"]),
  leadId: z.string().optional(),
});

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
    followups: partial.followups ?? initialState.followups,
    highlightedLeadIds:
      partial.highlightedLeadIds ?? initialState.highlightedLeadIds,
  };
}

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

function LiveFollowupList() {
  const { state, setState } = useLiveAgentState();
  const setFollowups = (next: Followup[]) =>
    setState((prev) => ({ ...prev, followups: next }));
  return (
    <FollowupList
      followups={state.followups}
      leads={state.leads}
      onToggle={(id) =>
        setFollowups(
          state.followups.map((f) =>
            f.id === id
              ? { ...f, status: f.status === "done" ? "pending" : "done" }
              : f,
          ),
        )
      }
      onAdd={(text, leadId) =>
        setFollowups([
          ...state.followups,
          {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `f-${Date.now()}`,
            text,
            status: "pending",
            leadId,
          },
        ])
      }
      onRemove={(id) =>
        setFollowups(state.followups.filter((f) => f.id !== id))
      }
    />
  );
}

export interface LeadCopilotShellProps {
  mode: "chat" | "app";
}

export function LeadCopilotShell({ mode }: LeadCopilotShellProps) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();

  // ----- localStorage durability ----------------------------------------
  // Hydrate empty state from cache on first mount; persist whenever leads
  // change. New threads inherit the cached snapshot so the user doesn't
  // have to re-import after starting fresh chats.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!agent) return;
    const current = mergeAgentState(agent.state);
    // Only attempt to read cache when state is empty; either way, we
    // mark hydration complete so the auto-navigation effect below can
    // distinguish "load-time replay" from "fresh import".
    if (current.leads.length === 0) {
      try {
        const raw = window.localStorage.getItem(LEADS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.leads && Array.isArray(parsed.leads)) {
            agent.setState({
              ...current,
              leads: parsed.leads,
              sync: parsed.sync ?? current.sync,
              header: parsed.header ?? current.header,
            });
          }
        }
      } catch {
        // localStorage unavailable / parse error — fall through silently
      }
    }
    hydratedRef.current = true;
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    const current = mergeAgentState(agent.state);
    if (current.leads.length === 0) return;
    try {
      window.localStorage.setItem(
        LEADS_CACHE_KEY,
        JSON.stringify({
          leads: current.leads,
          sync: current.sync,
          header: current.header,
        }),
      );
    } catch {
      // quota / disabled — silently skip persistence
    }
  }, [agent, agent?.state]);

  // (Auto-promote-to-canvas was removed: LeadStateMiddleware hydrates the
  // agent's state from the local lead store on every fresh thread's first
  // turn, so any unrelated prompt would fire the navigation. The chat
  // header's "Open canvas (N leads)" link is the explicit signal instead.)

  // ----- Suggestion chips -----------------------------------------------

  useConfigureSuggestions({
    available: "before-first-message",
    suggestions:
      mode === "chat"
        ? [
            {
              title: "Import from Notion",
              message: "Import the leads from Notion.",
            },
            {
              title: "What's hot?",
              message: "What workshops are most in demand right now?",
            },
            {
              title: "Plan follow-ups",
              message:
                "Add follow-up tasks for the top 3 hottest leads and show the list.",
            },
            {
              title: "Profile a lead",
              message: "Tell me about Ada Lovelace and show her mini card.",
            },
          ]
        : [
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
              title: "Plan follow-ups",
              message:
                "Add follow-up tasks for the top 3 hottest leads and show the list.",
            },
            {
              title: "Profile a lead",
              message: "Tell me about Ada Lovelace and show her mini card.",
            },
          ],
  });

  // ----- injectPrompt helper --------------------------------------------

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

  // ----- Optimistic-write tracking (app-mode only) ----------------------

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

  // ----- State-mutator frontend tools -----------------------------------

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

  // ----- A2UI shared-state demo: manage_followups -----------------------
  // This is the threads-demo "manage_todos" pattern, adapted: state.followups
  // is read+write for both the agent (via this tool) and the user (via the
  // FollowupList component). Each side overwrites the full list on each
  // edit, so they can never disagree about what items exist.
  useFrontendTool({
    name: "manage_followups",
    description:
      "Manage the shared follow-ups list. Pass the FULL list each call (the agent and the user both edit this list, so partial patches would lose user-side adds). Each item: { id, text, status: 'pending'|'done', leadId? }. Always include status. Call renderFollowups after this so the user can see the result.",
    parameters: z.object({ followups: z.array(followupShape) }),
    handler: async ({ followups }) => {
      updateState((prev) => ({ ...prev, followups: followups as Followup[] }));
      return `set ${followups.length} follow-ups`;
    },
  });

  useFrontendTool({
    name: "renderFollowups",
    description:
      "Render the shared follow-ups list inline in chat. Reads live agent state, takes no args. Call this after manage_followups, or any time the user asks to see / review the follow-up list.",
    parameters: z.object({}),
    render: () => <LiveFollowupList />,
  });

  // ----- Optimistic write: commitLeadEdit (app-mode only) ---------------

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

  // Watch tool-message tail for write confirmations / failures.
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

  // ----- Controlled gen UI: named renderers -----------------------------

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
        onSelect={(id) =>
          updateState((prev) => ({ ...prev, selectedLeadId: id }))
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

  // Open generative UI catch-all. The ignore list matches the
  // threads-demo: A2UI internal tools are rendered by the A2UI subsystem
  // (the `openGenerativeUI={{}}` provider config), so the wildcard must
  // skip them — otherwise the same tool call mounts twice and React
  // raises duplicate-key warnings on the chat message list.
  useDefaultRenderTool({
    render: ({ name, status, result, parameters }) => {
      if (
        name === "render_a2ui" ||
        name === "generate_a2ui" ||
        name === "log_a2ui_event"
      ) {
        return <></>;
      }
      return (
        <ToolFallbackCard
          name={name}
          status={status}
          result={result}
          parameters={parameters}
        />
      );
    },
  });

  // ----- Render ---------------------------------------------------------

  const visibleLeads = useMemo(
    () => applyFilter(state.leads, state.filter),
    [state.leads, state.filter],
  );

  const handleSelect = (id: string) =>
    updateState((prev) => ({
      ...prev,
      selectedLeadId: prev.selectedLeadId === id ? null : id,
    }));

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

  if (mode === "chat") {
    return (
      <ChatOnlyView leadCount={state.leads.length} threadHasRun={(agent?.messages?.length ?? 0) > 0} />
    );
  }

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

function ChatOnlyView({
  leadCount,
  threadHasRun,
}: {
  leadCount: number;
  threadHasRun: boolean;
}) {
  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-[#EDEDF5] bg-white px-6 py-3">
        <div className="flex items-center gap-2 text-foreground">
          <span className="grid size-6 place-items-center rounded-md bg-[#BEC2FF]">
            <MessageCircle size={14} />
          </span>
          <span className="font-mono text-[12px] uppercase tracking-wide">
            Lead-form chat
          </span>
        </div>
        <Link
          aria-label="Open canvas mode"
          href="/leads"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#DBDBE5] bg-white px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-[#F5F5FA]"
        >
          <LayoutDashboard size={14} />
          <span>
            {leadCount > 0 ? `Open canvas (${leadCount} leads)` : "Open canvas"}
          </span>
        </Link>
      </header>

      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col overflow-hidden bg-white">
        <CopilotChat
          input={{ disclaimer: () => null }}
          welcomeScreen={!threadHasRun && leadCount === 0 ? true : false}
        />
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            error: "!bg-rose-50 !text-rose-900 !border !border-rose-200",
          },
        }}
      />
    </div>
  );
}
