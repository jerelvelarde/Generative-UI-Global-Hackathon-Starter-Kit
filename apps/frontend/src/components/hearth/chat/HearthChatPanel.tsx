"use client";

/**
 * F-12 — Hearth chat panel.
 *
 * Wraps CopilotKit v2's CopilotPopup so we get the spec'd "collapsed pill at
 * bottom of canvas, expand on click into a chat panel" behavior. The Sidebar
 * component (right-edge slide-out) is the wrong shape for F-12; Popup is a
 * bottom-pill toggle plus a floating panel and matches by construction.
 *
 * This file owns the Hearth chrome (label text, dimensions, idle dim). The
 * agent wiring (provider, agentId, threadId) stays in app/page.tsx so it
 * remains symmetric with goal submission and regen triggers.
 *
 * Dimming on idle (F-15) lowers the toggle button + open panel opacity but
 * keeps pointer events live — the user can still click into the chat to
 * re-engage; that click is itself an activity event and unfades the rest
 * of the chrome.
 */
import { CopilotPopup } from "@copilotkit/react-core/v2";

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = "min(560px, 60vh)";

const LABELS = {
  chatTitle: "Mood Architect",
  chatInputPlaceholder: "Tell the room what to do…",
  chatWelcomeTitle: "What kind of attention does this need?",
  chatWelcomeMessage:
    "Type how you'd describe the work. The Mood Architect will pick the levers.",
};

export function HearthChatPanel({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <div
      className={`transition-opacity duration-700 ${
        dimmed ? "opacity-30 hover:opacity-100 focus-within:opacity-100" : "opacity-100"
      }`}
    >
      <CopilotPopup
        defaultOpen={false}
        clickOutsideToClose
        width={PANEL_WIDTH}
        height={PANEL_HEIGHT}
        labels={LABELS}
        input={{ disclaimer: () => null, className: "pb-6" }}
      />
    </div>
  );
}
