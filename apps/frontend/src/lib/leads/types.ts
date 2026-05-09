export type TechLevel =
  | "Non-technical"
  | "Some technical"
  | "Developer"
  | "Advanced / expert";

export type Workshop =
  | "Agentic UI (AG-UI)"
  | "MCP Apps / Tooling"
  | "RAG & Data Chat"
  | "Evaluations & Guardrails"
  | "Deploying Agents (prod)"
  | "Not sure yet";

export type Source =
  | "Website"
  | "Referral"
  | "LinkedIn"
  | "X/Twitter"
  | "Event"
  | "Other";

export type LeadStatus = "Not started" | "In progress" | "Done";

export const STATUSES: readonly LeadStatus[] = [
  "Not started",
  "In progress",
  "Done",
] as const;

export const WORKSHOPS: readonly Workshop[] = [
  "Agentic UI (AG-UI)",
  "MCP Apps / Tooling",
  "RAG & Data Chat",
  "Evaluations & Guardrails",
  "Deploying Agents (prod)",
  "Not sure yet",
] as const;

export const TECH_LEVELS: readonly TechLevel[] = [
  "Non-technical",
  "Some technical",
  "Developer",
  "Advanced / expert",
] as const;

export interface Lead {
  id: string;
  url?: string;
  name: string;
  company: string;
  email: string;
  role: string;
  phone?: string;
  source?: string;
  technical_level: string;
  interested_in: string[];
  tools: string[];
  workshop: string;
  status: string;
  opt_in: boolean;
  message: string;
  submitted_at: string;
}

export interface LeadFilter {
  workshops: string[];
  technical_levels: string[];
  tools: string[];
  opt_in: "any" | "yes" | "no";
  search: string;
}

export interface SyncMeta {
  databaseId: string;
  databaseTitle: string;
  syncedAt: string | null;
}

// Follow-up tasks the user/agent can both edit. This is the canonical
// shared-state (A2UI) demo from the threads-demo starter, ported to the
// lead-form domain — instead of generic todos, items are scoped to a lead
// (or unscoped for general next-actions).
export interface Followup {
  id: string;
  text: string;
  status: "pending" | "done";
  leadId?: string;
}

export interface AgentState {
  leads: Lead[];
  filter: LeadFilter;
  highlightedLeadIds: string[];
  selectedLeadId: string | null;
  header: { title: string; subtitle: string };
  sync: SyncMeta;
  followups: Followup[];
}

// Mirrors the Python `NotionHealth` TypedDict in
// agent/src/notion_integration.py. Returned by the agent's
// `notion_health_check` tool when the user pings the Notion DB.
export interface NotionHealth {
  user_id: string;
  db_title: string;
  row_count: number;
  expected_props: string[];
  actual_props: string[];
  missing_props: string[];
  error: string | null;
}
