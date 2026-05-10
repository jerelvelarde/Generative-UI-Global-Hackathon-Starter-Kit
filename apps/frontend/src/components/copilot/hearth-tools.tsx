"use client";

/**
 * Hearth frontend tools + agent-state bridge.
 *
 * Two concerns, one file (both C-track wiring):
 *
 * 1. The four CopilotKit frontend tools the chat agent (B's runtime.py)
 *    calls to mutate the room. Per F-06 + B's MoodStateMiddleware:
 *    - updateLeverValue / addLever / swapScene mutate the Zustand store
 *      directly (granular nudges).
 *    - regenerateMoodProfile is a SIGNAL tool — per B's prompt at
 *      apps/agent/src/prompts.py:95, the agent calls it to announce a regen
 *      is happening. The actual profile arrives via state.profile sync
 *      (see useAgentProfileBridge below), driven by the backend tools
 *      classify_mood_for_goal / regenerate_mood_profile that emit a
 *      Command(update={"profile": ...}) on the agent state.
 *
 * 2. The agent-state -> Zustand bridge. B's MoodStateMiddleware ships
 *    state.profile through STATE_SNAPSHOT to the frontend's agent.state.
 *    Without an explicit bridge that profile never reaches our store.
 *    useAgentProfileBridge() is that bridge — validate, then applyProfile.
 *
 * Mount this component once inside the CopilotKitProvider tree
 * (see app/page.tsx). Renders nothing.
 */

import { useEffect } from "react";
import { useAgent, useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import { useHearthStore } from "@/lib/hearth/store";
import { Lever, MoodProfile, SceneId } from "@/lib/hearth/schema";
import { useOutOfBoundsDetector } from "@/lib/hearth/genui/outOfBounds";
import { useRegenWiring } from "@/lib/hearth/genui/regenerate";
import { recordTrace } from "@/lib/hearth/trace";

/**
 * Convert an agent-friendly leverId into the dot-path the store mutates.
 * Reads the latest profile from the store so it stays current even if a
 * lever was just added in the same agent turn.
 */
function resolveLeverPath(leverId: string): string | null {
  const lever = useHearthStore
    .getState()
    .profile.levers.find((l) => l.id === leverId);
  return lever?.bindTo ?? null;
}

/**
 * Pipe agent.state.profile -> Zustand whenever it changes.
 *
 * This is how F-02 (welcome goal classification) and F-08 (mic-drop regen)
 * actually reach the frontend. The chat agent's backend tools update
 * state.profile via Command; LangGraph emits STATE_SNAPSHOT; CopilotKit
 * exposes that as agent.state on the React side; this hook copies it
 * into our store so A's components re-render.
 */
function useAgentProfileBridge() {
  const { agent } = useAgent();
  const applyProfile = useHearthStore((s) => s.applyProfile);
  const agentProfile = (agent?.state as { profile?: unknown } | undefined)
    ?.profile;

  useEffect(() => {
    if (!agentProfile) return;
    const parsed = MoodProfile.safeParse(agentProfile);
    if (parsed.success) {
      applyProfile(parsed.data);
      recordTrace({
        kind: "agent.profile.applied",
        label: "Mood Architect → MoodProfile",
        detail: `${parsed.data.goal.kind} · ${parsed.data.levers.length} levers · scene ${parsed.data.visual.sceneId}`,
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[hearth] agent.state.profile failed validation",
        JSON.stringify(parsed.error.issues, null, 2),
        "RECEIVED:",
        JSON.stringify(agentProfile, null, 2),
      );
    }
  }, [agentProfile, applyProfile]);
}

export function HearthFrontendTools() {
  const setLeverValue = useHearthStore((s) => s.setLeverValue);
  const addLever = useHearthStore((s) => s.addLever);
  const swapScene = useHearthStore((s) => s.swapScene);

  useAgentProfileBridge();
  useRegenWiring();
  useOutOfBoundsDetector();

  useFrontendTool({
    name: "updateLeverValue",
    description:
      "Set the value of an existing lever by id. Use to nudge the room — raise rain intensity, drop bpm, etc. Value is interpreted per the lever's kind: number for slider, option-value string for segmented, 0/1 for toggle.",
    parameters: z.object({
      leverId: z.string(),
      value: z.union([z.number(), z.string()]),
    }),
    handler: async ({ leverId, value }) => {
      const path = resolveLeverPath(leverId);
      if (!path) return `unknown lever id: ${leverId}`;
      setLeverValue(path, value);
      recordTrace({
        kind: "tool.updateLeverValue",
        label: `Tool: updateLeverValue`,
        detail: `${leverId} → ${value}`,
      });
      return `set ${leverId} (${path}) -> ${value}`;
    },
  });

  useFrontendTool({
    name: "addLever",
    description:
      "Add a new lever to the Lever Card. The agent uses this to introduce a control tailored to the user's goal that wasn't in the initial profile.",
    parameters: z.object({ lever: Lever }),
    handler: async ({ lever }) => {
      addLever(lever);
      recordTrace({
        kind: "tool.addLever",
        label: `Tool: addLever`,
        detail: `${lever.label} (${lever.id}) → ${lever.bindTo}`,
      });
      return `added lever ${lever.id} bound to ${lever.bindTo}`;
    },
  });

  useFrontendTool({
    name: "swapScene",
    description:
      "Morph the room to a different scene (forest_cabin or warm_bedroom). Used by F-08 regen when the agent decides the goal needs a different environment.",
    parameters: z.object({ sceneId: SceneId }),
    handler: async ({ sceneId }) => {
      swapScene(sceneId);
      recordTrace({
        kind: "tool.swapScene",
        label: `Tool: swapScene`,
        detail: `scene → ${sceneId}`,
      });
      return `scene -> ${sceneId}`;
    },
  });

  // F-08 signal tool. The agent calls this to announce a mood-category
  // regen is happening; the actual profile arrives via state.profile sync
  // (see useAgentProfileBridge). Matches B's prompt at prompts.py:95.
  useFrontendTool({
    name: "regenerateMoodProfile",
    description:
      "Signal that you are emitting a fresh MoodProfile reflecting a new mood category (F-08 mic-drop). The frontend uses `reason` for the trace panel and any UI fade. The actual profile update arrives via your backend regenerate_mood_profile tool's state Command.",
    parameters: z.object({ reason: z.string() }),
    handler: async ({ reason }) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[hearth] regen signal:", reason);
      }
      recordTrace({
        kind: "tool.regenerateMoodProfile",
        label: "Tool: regenerateMoodProfile",
        detail: reason,
      });
      return `regen signal received: ${reason}`;
    },
  });

  return null;
}
