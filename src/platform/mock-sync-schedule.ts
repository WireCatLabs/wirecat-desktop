import { findTool } from "@/domain/catalog"
import type { SyncSchedule } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// An account's sync on a timer, the tool's own `schedule command`. Off at first. `?sync-schedule=on`: Email personal
// syncs every 5 minutes, last run 3 minutes ago; `?sync-schedule=failing`: that schedule fails since this morning;
// `?sync-schedule-fail=1`: turning one on fails with the tool's words. `?sync-recovered=email`: Email personal's sync
// from the app fails with configuration_error, and its schedule's next run (10 s later) succeeds, so the error clears
// when the row next reads the schedule. A schedule's test run (`schedule run`) succeeds after 3 s;
// `?schedule-test=fail` fails it as a signed-out account would, with the run's output. Opening WireCat at login is
// on by default; `?autostart-fail=1` refuses to change it, as a test copy does.

const MIN = 60_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

type Mocked = "syncScheduleStatus" | "syncScheduleSet" | "syncScheduleTest" | "autostartStatus" | "autostartSet"

export function syncScheduleMock(params: URLSearchParams): Pick<Platform, Mocked> {
  const scenario = params.get("sync-schedule")
  const recovered = params.get("sync-recovered")
  const started = Date.now()
  const states = new Map<string, SyncSchedule>()
  let autostart = true
  const initial = (id: string, profile: string): SyncSchedule => {
    if (recovered === id && profile === "personal")
      return Date.now() - started > 10_000
        ? { state: "on", when: "every 5m", every: "5m", daily: null, last: run(ago(0), 0) }
        : { state: "on", when: "every 5m", every: "5m", daily: null, last: run(ago(6 * 60 * MIN), 0) }
    if (id !== "email" || profile !== "personal") return { state: "off" }
    if (scenario === "on")
      return { state: "on", when: "every 5m", every: "5m", daily: null, last: run(ago(3 * MIN), 0) }
    if (scenario === "failing")
      return {
        state: "on",
        when: "every 5m",
        every: "5m",
        daily: null,
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
    async syncScheduleSet(id, profile, every, at) {
      await delay(800)
      if ((every || at) && params.get("sync-schedule-fail"))
        throw new Error("could not write the timer: systemctl --user is not available")
      const choices = findTool(id)?.sync?.schedule?.choices ?? []
      if (every && !choices.includes(every)) throw new Error(`not an interval it offers: ${every}`)
      const next: SyncSchedule = every
        ? { state: "on", when: `every ${every}`, every, daily: null, last: null }
        : at
          ? { state: "on", when: `daily at ${at}`, every: null, daily: at, last: null }
          : { state: "off" }
      states.set(`${id}:${profile}`, next)
      return next
    },
    async syncScheduleTest(id, profile) {
      await delay(3000)
      const failed = params.get("schedule-test") === "fail"
      const key = `${id}:${profile}`
      const now = states.get(key) ?? initial(id, profile)
      if (now.state === "on") states.set(key, { ...now, last: run(ago(0), failed ? 1 : 0) })
      return failed
        ? {
            exitCode: 1,
            reason: "authentication_error",
            output: `${id} ${profile}: syncing 12 chats\nerror: the session has ended; sign in again (${id} ${profile} login)`,
          }
        : { exitCode: 0, reason: null, output: `${id} ${profile}: synced 12 chats, 340 new messages` }
    },
    async autostartStatus() {
      await delay(100)
      return autostart
    },
    async autostartSet(on) {
      await delay(300)
      if (params.get("autostart-fail")) throw new Error("a test or development copy of WireCat does not start at login")
      autostart = on
      return autostart
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
