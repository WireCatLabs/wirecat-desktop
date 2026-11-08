import { findTool } from "@/domain/catalog"
import type { SyncSchedule } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// An account's sync on a timer, the tool's own `schedule command`. Off at first. `?sync-schedule=on`: Email personal
// syncs every 5 minutes, last run 3 minutes ago; `?sync-schedule=failing`: that schedule fails since this morning;
// `?sync-schedule-fail=1`: turning one on fails with the tool's words. `?sync-recovered=email`: Email personal's sync
// from the app fails with configuration_error, and its schedule's next run (10 s later) succeeds, so the error clears
// when the row next reads the schedule.

const MIN = 60_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

export function syncScheduleMock(params: URLSearchParams): Pick<Platform, "syncScheduleStatus" | "syncScheduleSet"> {
  const scenario = params.get("sync-schedule")
  const recovered = params.get("sync-recovered")
  const started = Date.now()
  const states = new Map<string, SyncSchedule>()
  const initial = (id: string, profile: string): SyncSchedule => {
    if (recovered === id && profile === "personal")
      return Date.now() - started > 10_000
        ? { state: "on", when: "every 5m", every: "5m", last: run(ago(0), 0) }
        : { state: "on", when: "every 5m", every: "5m", last: run(ago(6 * 60 * MIN), 0) }
    if (id !== "email" || profile !== "personal") return { state: "off" }
    if (scenario === "on") return { state: "on", when: "every 5m", every: "5m", last: run(ago(3 * MIN), 0) }
    if (scenario === "failing")
      return {
        state: "on",
        when: "every 5m",
        every: "5m",
        last: {
          ...run(ago(2 * MIN), 2),
          reason: "configuration_error",
          failures: 41,
          failingSince: ago(9 * 60 * MIN),
        },
      }
    return { state: "off" }
  }
  return {
    async syncScheduleStatus(id, profile) {
      await delay(300)
      return states.get(`${id}:${profile}`) ?? initial(id, profile)
    },
    async syncScheduleSet(id, profile, every) {
      await delay(800)
      if (every && params.get("sync-schedule-fail"))
        throw new Error("could not write the timer: systemctl --user is not available")
      const choices = findTool(id)?.sync?.schedule?.choices ?? []
      if (every && !choices.includes(every)) throw new Error(`not an interval it offers: ${every}`)
      const next: SyncSchedule = every ? { state: "on", when: `every ${every}`, every, last: null } : { state: "off" }
      states.set(`${id}:${profile}`, next)
      return next
    },
  }
}

const run = (at: string, exitCode: number) => ({
  at,
  exitCode,
  reason: null,
  failures: null,
  failingSince: null,
  costUsd: null,
  skipped: null,
  deliveries: [],
})
