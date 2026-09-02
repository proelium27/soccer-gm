import { useState } from "react";
import { buildImportPromptText } from "../../core/teams/rosterAiPrompt.js";
import type { RosterSlotWorld } from "../../core/teams/rosterFile.js";

/**
 * The "Copy AI Prompt to Customize" control, shared by every surface that
 * offers it.
 *
 * It is one component rather than three copies because the three surfaces are
 * genuinely the same action and the parts that are easy to get subtly wrong —
 * the clipboard fallback, the transient confirmation, the filename the fallback
 * downloads — are exactly the parts nobody would keep in sync by hand. Only the
 * class name and the wording differ, so those are props and nothing else is.
 *
 * `world` is a RosterSlotWorld, so a caller can be a loaded save (TopBar) or a
 * world that does not exist yet (the Leagues and New League screens, via
 * worldTeamSlots) — see buildImportPromptText for why that matters.
 */
export function CopyAiPromptButton({
  world,
  className,
  label = "Copy AI Prompt to Customize",
  copiedLabel = "Copied!",
  title = "Copy a paste-ready prompt that teaches an AI this world's team-import format",
  disabled = false,
}: {
  world: RosterSlotWorld | null;
  className: string;
  label?: string;
  copiedLabel?: string;
  title?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!world) return;
    const prompt = buildImportPromptText(world);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard can be blocked (permissions/insecure context); fall back to a download.
      const blob = new Blob([prompt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soccer-gm-ai-prompt.txt";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={className} onClick={copy} disabled={disabled || !world} title={title}>
      {copied ? copiedLabel : label}
    </button>
  );
}
