import type { MailAgent } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Email's mail agent: off at first. `?mail-agent=on` starts on with a run 12 minutes ago, `?mail-agent=capped` on
// with the day's cost cap reached, `?mail-agent=failed` on with two failed runs, `?mail-agent=noclaude` off with
// Claude Code missing, `?mail-agent=nomemo` without memo, `?mail-agent=old` with a memo too old;
// `?mail-agent-fail=1` makes turning it on fail with memo's words.
export function mailAgentMock(
  params: URLSearchParams,
): Pick<Platform, "mailAgentStatus" | "mailAgentSet" | "mailAgentWaiting"> {
  const scenario = params.get("mail-agent")
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const on = (over: Partial<Extract<MailAgent, { state: "on" }>> = {}): MailAgent => ({
    state: "on",
    when: "every 5m",
    last: { at: ago(12), exitCode: 0, reason: null, failures: null },
    spentTodayUsd: 0.84,
    ...over,
  })
  const start = (): MailAgent => {
    if (scenario === "on") return on()
    if (scenario === "capped")
      return on({
        last: {
          at: ago(4),
          exitCode: 1,
          reason: "today's runs cost $5.02, the $5.00 a day allowed; it runs again tomorrow",
          failures: null,
        },
        spentTodayUsd: 5.02,
      })
    if (scenario === "failed")
      return on({ last: { at: ago(3), exitCode: 1, reason: null, failures: 2 }, spentTodayUsd: 0.31 })
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
    async mailAgentSet(_id, turnOn) {
      await delay(900)
      if (turnOn && params.get("mail-agent-fail")) throw new Error("claude is not on PATH")
      state = turnOn ? on({ last: null, spentTodayUsd: 0 }) : { state: "off", harness: true }
      return state
    },
    async mailAgentWaiting() {
      await delay(700)
      return state.state === "noMemo" || state.state === "old" ? null : 17
    },
  }
}
