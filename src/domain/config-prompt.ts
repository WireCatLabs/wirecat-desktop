import type { CatalogTool } from "./catalog"
import type { Finding } from "./doctor"

/** Agents whose docs name a way to start with a first prompt; `src-tauri/src/agent_fix.rs` holds the same list. */
export const FIX_AGENTS = ["claude", "codex", "gemini", "opencode"]

/**
 * What an agent is asked to do about one problem in a tool's settings file. Always English: it is read by the agent,
 * not by the owner. It names the place and the problem and never a value, as the finding itself never holds one.
 */
export function configPrompt(tool: CatalogTool, finding: Finding, profile: string | null): string {
  const at = finding.config ?? {}
  const file = at.file ?? `the ${tool.name} settings file`
  const until = tool.doctor.findIndex((w) => w.startsWith("-"))
  const check = [tool.bin, ...(until < 0 ? tool.doctor : tool.doctor.slice(0, until))]
    .map((w) => (w === "{profile}" ? (at.profile ?? profile ?? "<profile>") : w))
    .join(" ")
  const syntax = at.kind === "invalid_json"
  const where =
    at.line === undefined ? null : `line ${at.line}${at.column === undefined ? "" : `, column ${at.column}`}`
  const lines = [
    `WireCat Desktop found a problem in the settings file of ${tool.name} (the \`${tool.bin}\` command-line tool).`,
    "",
    `File: ${file}`,
    where && `Where: ${where}`,
    at.profile && `Profile: ${at.profile}`,
    at.key && `Setting: ${at.key}`,
    `Problem${at.kind ? ` (${at.kind})` : ""}: ${finding.text ?? "a setting is not valid"}`,
    finding.fix && `${tool.name} suggests this command to fix it: \`${finding.fix}\``,
    "",
    "Fix only this problem:",
    `1. First make a backup copy of the file next to it, named with .bak and today's date. Do not skip this.`,
    syntax
      ? `2. Fix only the JSON syntax${where ? ` at or just before ${where}` : ""}: a missing or extra comma, quote or bracket. Do not add, remove, rename, reorder or change any setting or value.`
      : finding.fix
        ? "2. Prefer running the suggested command. If you edit the file instead, change only the setting named above."
        : `2. Change only ${at.key ? `the setting ${at.key}` : "what the problem names"}. Leave every other setting as it is.`,
    "3. The file can hold tokens and keys. Never print, quote or copy a setting's value here; name settings only.",
    "4. If you are not sure what the right value is, stop and ask me instead of guessing.",
    `5. When it is fixed, run \`${check}\` and check that this problem is gone. Then tell me in one sentence what you changed, without quoting values.`,
  ]
  return lines.filter((l) => typeof l === "string").join("\n")
}
