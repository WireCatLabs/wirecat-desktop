export type Problem = {
  /** What WireCat was doing, in English: "Installing Telegram (@wirecat/tg-cli)". */
  what: string
  error: string
  hint: string | null
  /** Masked by Rust before it reached the interface. */
  log?: readonly string[]
}

export type Machine = { os: string; app: string }

const LOG_LINES = 60

/**
 * The prompt an AI agent gets to fix a failed step. Always English: agents follow it best, and the owner's own
 * agent answers in the owner's language anyway. The limits are the owner's, said up front, so the agent asks first.
 */
export function fixPrompt(p: Problem, m: Machine): string {
  const log = (p.log ?? []).slice(-LOG_LINES)
  return [
    `WireCat Desktop ${m.app} on ${m.os} failed while ${lower(p.what)}.`,
    "",
    `Error: ${p.error}`,
    ...(p.hint ? [`WireCat's suggestion: ${p.hint}`] : []),
    ...(log.length ? ["", "Last lines of the log:", "```", ...log, "```"] : []),
    "",
    "Please find the cause on this computer and fix it.",
    "- Explain what you found before you change anything, and say what each command will do.",
    "- Ask me before running a command that changes something. Do not use sudo or administrator rights;",
    "  if that is the only way, tell me what to run myself.",
    "- Do not delete my data, settings or sign-in tokens.",
    "- When it is fixed, tell me to go back to WireCat and press Try again.",
  ].join("\n")
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
