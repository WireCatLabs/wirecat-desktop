import type { MailAgent } from "./bindings"
import { delay } from "./mock-delay"
import { memoDefault } from "./mock-memo"
import type { Platform } from "./types"

// Email's mail agent: off at first. `?mail-agent=on` starts on, every 30 minutes, with a run 12 minutes ago, `?mail-agent=capped` on
// with the day's cost cap reached, `?mail-agent=failed` on with two failed runs,
// `?mail-agent=nocap` on from a memo that does not report its caps, `?mail-agent=noclaude` off with
// Claude Code missing, `?mail-agent=nomemo` without memo, `?mail-agent=old` with a memo too old;
// `?mail-agent-fail=1` makes turning it on fail with memo's words; `?mail-agent=nocredit` on through Claude Code, whose
// last two runs failed for lack of credit, `?mail-agent=codexlimit` on through Codex at its usage limit.
export function mailAgentMock(
  params: URLSearchParams,
): Pick<Platform, "mailAgentStatus" | "mailAgentSet" | "mailAgentWaiting"> {
  const scenario = params.get("mail-agent") ?? memoDefault({ missing: "nomemo", old: "old" })
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const on = (over: Partial<Extract<MailAgent, { state: "on" }>> = {}): MailAgent => ({
    state: "on",
    when: "every 30m",
    every: "30m",
    last: { at: ago(12), exitCode: 0, reason: null, failures: null, skipped: null },
    spentTodayUsd: 0.84,
    maxCostUsd: 1,
    maxCostPerDayUsd: 5,
    agent: "claude",
    trouble: null,
    ...over,
  })
  const start = (): MailAgent => {
    if (scenario === "on") return on()
    if (scenario === "capped")
      return on({
        last: {
          at: ago(9),
          exitCode: 0,
          reason: null,
          failures: null,
          skipped: {
            at: ago(4),
            why: "today's runs cost $5.02, the $5.00 a day allowed; it runs again tomorrow",
            reason: "cost.day-cap",
          },
        },
        spentTodayUsd: 5.02,
      })
    if (scenario === "failed")
      return on({
        last: { at: ago(3), exitCode: 1, reason: "provider_error (claude.exit)", failures: 2, skipped: null },
        spentTodayUsd: 0.31,
      })
    if (scenario === "nocredit")
      return on({
        last: { at: ago(3), exitCode: 1, reason: "exit 1", failures: 2, skipped: null },
        spentTodayUsd: 0,
        trouble: { agent: "claude", kind: "noCredit", line: "Credit balance is too low" },
      })
    if (scenario === "codexlimit")
      return on({
        last: { at: ago(3), exitCode: 1, reason: "exit 1", failures: 1, skipped: null },
        spentTodayUsd: null,
        maxCostUsd: null,
        agent: "codex",
        trouble: { agent: "codex", kind: "limit", line: "You've hit your usage limit. Try again at 3:45 PM." },
      })
    if (scenario === "nocap") return on({ maxCostUsd: null, maxCostPerDayUsd: null })
    if (scenario === "nomemo") return { state: "noMemo" }
    if (scenario === "old") return { state: "old", version: "0.131.20", need: "0.131.26" }
    return { state: "off", harness: scenario !== "noclaude" }
  }
  let state = start()
  return {
    async mailAgentStatus() {
      await delay(350)
      return state
    },
    async mailAgentSet(_id, turnOn, every = "30m", agent) {
      await delay(900)
      if (turnOn && params.get("mail-agent-fail")) throw new Error("claude is not on PATH")
      const kept =
        state.state === "on" && !agent
          ? { last: state.last, spentTodayUsd: state.spentTodayUsd, agent: state.agent, trouble: state.trouble }
          : { last: null, spentTodayUsd: 0, agent: agent ?? "claude", trouble: null }
      state = turnOn ? on({ ...kept, when: `every ${every}`, every }) : { state: "off", harness: true }
      return state
    },
    async mailAgentWaiting() {
      await delay(700)
      return state.state === "noMemo" || state.state === "old" ? null : 17
    },
  }
}
