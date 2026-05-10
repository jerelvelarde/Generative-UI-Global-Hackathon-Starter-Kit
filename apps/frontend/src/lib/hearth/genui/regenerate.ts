"use client";

/**
 * F-08 trigger — sends "Regenerate the room: <reason>" to the Mood Architect
 * and kicks the agent run.
 *
 * Why a module-scoped ref instead of passing deps to triggerRegen():
 *  outOfBounds.ts fires from inside a setTimeout that lives outside React's
 *  render cycle (per its `useHearthStore.subscribe` wiring). By the time we
 *  fire, we don't have a closure-fresh agent handle. So we keep refs at
 *  module scope and let a hook (`useRegenWiring`) sync them on every render.
 *
 * The `triggerRegen` signature is locked by outOfBounds.ts:155 — single
 * string argument, void return. Don't change it without coordinating.
 *
 * Mounting:
 *  Call useRegenWiring() once inside the CopilotKitProvider tree (e.g. from
 *  HearthFrontendTools, alongside useOutOfBoundsDetector). One call per page
 *  lifecycle.
 *
 * Message convention:
 *  The agent's prompt at apps/agent/src/prompts.py:99 + :125 explicitly
 *  branches on a user message that starts with "Regenerate the room:". That
 *  prefix IS the contract between C and B for F-08; do not paraphrase it.
 *
 * Pattern mirrors app/page.tsx:43-54 (the goal-submit path) line for line:
 *  randomUUID id, agent.addMessage({ id, role: "user", content }), then
 *  void copilotkit.runAgent({ agent }).catch(...).
 */

import { useEffect } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

import { recordTrace } from "@/lib/hearth/trace";

type Agent = NonNullable<ReturnType<typeof useAgent>["agent"]>;
type CopilotKit = ReturnType<typeof useCopilotKit>["copilotkit"];

const refs: { agent: Agent | null; copilotkit: CopilotKit | null } = {
  agent: null,
  copilotkit: null,
};

/**
 * Mount once inside the CopilotKitProvider tree. Keeps the module-level
 * agent/copilotkit refs current so triggerRegen() can fire from outside
 * React's render cycle (out-of-bounds setTimeout).
 */
export function useRegenWiring(): void {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();

  useEffect(() => {
    refs.agent = agent ?? null;
    refs.copilotkit = copilotkit;
    return () => {
      refs.agent = null;
      refs.copilotkit = null;
    };
  }, [agent, copilotkit]);
}

/**
 * Send "Regenerate the room: <reason>" and run the agent.
 *
 * Called by outOfBounds.ts after a lever has sustained out-of-bounds for
 * OUT_OF_BOUNDS_HOLD_MS. The reason string is plain-language — Gemini reads
 * it directly to decide how to acknowledge the shift in chat.
 */
export function triggerRegen(reason: string): void {
  const { agent, copilotkit } = refs;
  if (!agent || !copilotkit) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[hearth] triggerRegen fired before useRegenWiring mounted — dropping",
      );
    }
    return;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `regen-${Date.now()}`;

  agent.addMessage({
    id,
    role: "user",
    content: `Regenerate the room: ${reason}`,
  });

  recordTrace({
    kind: "regen.trigger",
    label: "Regenerate signal sent",
    detail: reason,
  });

  void copilotkit.runAgent({ agent }).catch((err: unknown) => {
    console.error("[hearth] regenerate failed", err);
  });
}
