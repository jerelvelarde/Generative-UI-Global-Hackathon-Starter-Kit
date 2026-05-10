"use client";

/**
 * Hearth root — H1 composition stub.
 *
 * C-track per docs/05-team-plan.md:
 *  - Mounts <CopilotChatConfigurationProvider> so the chat sidebar + agent
 *    are wired to the LangGraph deployment via the BFF.
 *  - Mounts <HearthFrontendTools /> so the Mood Architect agent can mutate
 *    the frontend MoodProfile store (F-06).
 *  - Renders a stub welcome panel that reads `profile.goal.description`
 *    from the store and lets the user submit a goal. THIS IS A STUB —
 *    A owns the real welcome experience under components/hearth/welcome/
 *    and this composition will swap in <WelcomeScreen /> + <Room /> when
 *    they land.
 *
 * agentId stays "default" until B renames the LangGraph to "hearth" in
 * apps/agent/langgraph.json. Flip both this and apps/bff/src/server.ts at
 * the same time when that happens.
 */

import { useCallback, useState } from "react";
import {
  CopilotChatConfigurationProvider,
  useAgent,
  useCopilotKit,
} from "@copilotkit/react-core/v2";

import { HearthFrontendTools } from "@/components/copilot/hearth-tools";
import { HearthChatPanel } from "@/components/hearth/chat/HearthChatPanel";
import { GoalPill } from "@/components/hearth/goal-pill/GoalPill";
import { TracePanel } from "@/components/hearth/trace/TracePanel";
import { useIdle } from "@/lib/hearth/idle";
import { useHearthStore } from "@/lib/hearth/store";

function HearthInner() {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const goal = useHearthStore((s) => s.profile.goal);
  const [draft, setDraft] = useState("");
  const idle = useIdle();

  const submitGoal = useCallback(
    (text: string) => {
      if (!agent) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `msg-${Date.now()}`;
      agent.addMessage({ id, role: "user", content: trimmed });
      void copilotkit.runAgent({ agent }).catch((err: unknown) => {
        console.error("[Hearth] runAgent failed", err);
      });
    },
    [agent, copilotkit],
  );

  return (
    <>
      <HearthFrontendTools />
      <GoalPill dimmed={idle} />
      <TracePanel dimmed={idle} />

      <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-12 bg-stone-950 text-stone-100">
        <div
          className={`flex flex-col items-center gap-2 transition-opacity duration-700 ${
            idle ? "opacity-30" : "opacity-100"
          }`}
        >
          <h1 className="text-4xl font-semibold tracking-tight">Hearth</h1>
          <p className="text-xs uppercase tracking-widest text-stone-500">
            agent-generated room
          </p>
        </div>

        <div
          className={`w-full max-w-md flex flex-col gap-2 transition-opacity duration-700 ${
            idle ? "opacity-30" : "opacity-100"
          }`}
        >
          <label className="text-xs uppercase tracking-widest text-stone-500">
            current goal
          </label>
          <p className="text-sm text-stone-300 italic min-h-[1.5rem]">
            {goal.description || "(no goal yet — describe what you're doing)"}
          </p>
        </div>

        <div
          className={`w-full max-w-md flex flex-col gap-3 transition-opacity duration-700 ${
            idle ? "opacity-30" : "opacity-100"
          }`}
        >
          <textarea
            className="bg-stone-900 border border-stone-800 rounded-md p-3 text-sm font-mono focus:outline-none focus:border-amber-500"
            rows={3}
            placeholder="What are you doing? (e.g. debugging concurrency for 90 minutes)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold py-2 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={!draft.trim() || !agent}
            onClick={() => {
              submitGoal(draft);
              setDraft("");
            }}
          >
            Build my room
          </button>
        </div>
      </main>

      <HearthChatPanel dimmed={idle} />
    </>
  );
}

export default function HearthPage() {
  return (
    <CopilotChatConfigurationProvider agentId="default" threadId={undefined}>
      <HearthInner />
    </CopilotChatConfigurationProvider>
  );
}
