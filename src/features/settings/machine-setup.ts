import { useEffect } from "react"
import { create } from "zustand"
import { type CatalogTool, syncSchedules, tools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { type MachineChoices, useMachineSetup } from "@/shared/machine-setup-store"
import { useOnboarding } from "@/shared/onboarding-store"
import { listProfiles, queryClient } from "@/shared/query"
import { useSignIn } from "@/shared/signin-store"
import { useTools } from "@/shared/tools-store"

export type Job = "nightly" | "live"

/** What applying a choice did to one account; a test run that failed keeps the run's own words for the agent. */
export type Step =
  | { phase: "working" }
  | { phase: "testing" }
  | { phase: "done"; tested?: boolean }
  /** The account already syncs on an interval the owner chose; the nightly sync leaves it as it is. */
  | { phase: "kept"; when: string }
  | { phase: "failed"; error: string; reason: string | null; log: string | null }

export type Item = { tool: string; profile: string; job: Job; step: Step }

type Autostart = { on: boolean | null; busy: boolean; error: string | null }

type State = {
  items: Record<string, Item>
  autostart: Autostart
  readAutostart(): Promise<void>
  setAutostart(on: boolean): Promise<void>
}

const keyOf = (tool: string, profile: string, job: Job) => `${job}:${tool}:${profile}`
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useMachineRuns = create<State>()((set) => ({
  items: {},
  autostart: { on: null, busy: false, error: null },
  async readAutostart() {
    try {
      const on = await platform.autostartStatus()
      set((s) => ({ autostart: { ...s.autostart, on } }))
    } catch (e) {
      set((s) => ({ autostart: { ...s.autostart, error: messageOf(e) } }))
    }
  },
  async setAutostart(on) {
    set((s) => ({ autostart: { ...s.autostart, busy: true, error: null } }))
    try {
      const now = await platform.autostartSet(on)
      set({ autostart: { on: now, busy: false, error: null } })
    } catch (e) {
      set((s) => ({ autostart: { ...s.autostart, busy: false, error: messageOf(e) } }))
    }
  },
}))

const put = (tool: string, profile: string, job: Job, step: Step) =>
  useMachineRuns.setState((s) => ({ items: { ...s.items, [keyOf(tool, profile, job)]: { tool, profile, job, step } } }))

const failed = (error: string, reason: string | null = null, log: string | null = null): Step => ({
  phase: "failed",
  error,
  reason,
  log,
})

// A test run is a whole sync of the account; several at once would compete for the network and the shared store.
let tests: Promise<void> = Promise.resolve()

async function testRun(tool: string, profile: string) {
  put(tool, profile, "nightly", { phase: "testing" })
  try {
    const t = await platform.syncScheduleTest(tool, profile)
    put(
      tool,
      profile,
      "nightly",
      t.exitCode === 0
        ? { phase: "done", tested: true }
        : failed(t.reason ?? `exit ${t.exitCode}`, t.reason, t.output || null),
    )
  } catch (e) {
    put(tool, profile, "nightly", failed(messageOf(e)))
  }
}

/**
 * The nightly sync for one account: made when the account has no schedule, moved when it already runs daily at
 * another time, and left alone when the owner set an interval of his own. A new one runs once at once, as a test.
 */
async function nightly(tool: string, profile: string, time: string | null) {
  if (time !== null && useMachineSetup.getState().offByHand.includes(`${tool}:${profile}`)) return
  put(tool, profile, "nightly", { phase: "working" })
  try {
    const now = await platform.syncScheduleStatus(tool, profile)
    if (time === null) {
      if (now.state === "on" && now.daily) await platform.syncScheduleSet(tool, profile, null)
      return useMachineRuns.setState((s) => {
        const { [keyOf(tool, profile, "nightly")]: _, ...items } = s.items
        return { items }
      })
    }
    if (now.state === "on" && !now.daily) return put(tool, profile, "nightly", { phase: "kept", when: now.when })
    if (now.state === "on" && now.daily === time) return put(tool, profile, "nightly", { phase: "done" })
    await platform.syncScheduleSet(tool, profile, null, time)
    if (now.state === "on") return put(tool, profile, "nightly", { phase: "done" })
    put(tool, profile, "nightly", { phase: "testing" })
    tests = tests.then(() => testRun(tool, profile))
    await tests
  } catch (e) {
    put(tool, profile, "nightly", failed(messageOf(e)))
  }
}

/** The messenger's own `serve` for one account: kept running and started at login, or stopped and removed. */
async function live(tool: string, profile: string, on: boolean) {
  put(tool, profile, "live", { phase: "working" })
  try {
    const now = await platform.backgroundStatus(tool, profile)
    const kept = now.state === "running" && now.startsAtLogin === true
    const idle = now.state === "stopped" && now.startsAtLogin !== true
    if (on ? !kept : !idle) {
      const outcome = await platform.backgroundRun(tool, profile, on ? "keep" : "uninstall")
      void queryClient().invalidateQueries({ queryKey: ["tool", tool, "background", profile] })
      if (outcome.fault) return put(tool, profile, "live", failed(outcome.fault.message))
    }
    put(tool, profile, "live", { phase: "done" })
  } catch (e) {
    put(tool, profile, "live", failed(messageOf(e)))
  }
}

const installed = (t: CatalogTool) => Boolean(useTools.getState().installs[t.id]?.length)
const forNightly = (t: CatalogTool) => syncSchedules(t)
const forLive = (t: CatalogTool) => Boolean(t.background)

/** Every signed-in account of the installed tools a job is for: all of them, never a first one picked for the owner. */
async function accounts(job: Job) {
  const list = tools.filter((t) => installed(t) && (job === "nightly" ? forNightly(t) : forLive(t)))
  const found = await Promise.all(
    list.map(async (t) => {
      const profiles = await listProfiles(t.id).catch(() => null)
      return (profiles ?? []).filter((p) => p.signedIn !== false).map((p) => ({ tool: t.id, profile: p.name }))
    }),
  )
  return found.flat()
}

/** Applies a changed choice to every account at once: Settings and the last setup step. */
export async function applyChoice(job: Job, c: MachineChoices) {
  const all = await accounts(job)
  await Promise.all(
    all.map((a) =>
      job === "nightly" ? nightly(a.tool, a.profile, c.nightly ? c.time : null) : live(a.tool, a.profile, c.live),
    ),
  )
}

/**
 * Applies what the owner turned on to one account that just signed in (named by the sign-in itself: the profile list
 * may still be the one read before it), or to every account when the setup ends.
 */
async function applyOn(only: { tool: string; profile: string } | null) {
  const c = useMachineSetup.getState()
  if (!c.answered) return
  const entry = only && tools.find((t) => t.id === only.tool)
  // The sweep at the end of the setup leaves alone what a sign-in already set up, so a failed test keeps its Fix.
  const fresh = (job: Job) => (a: { tool: string; profile: string }) =>
    !useMachineRuns.getState().items[keyOf(a.tool, a.profile, job)]
  const pick = async (job: Job, fits: (t: CatalogTool) => boolean) =>
    only ? (entry && fits(entry) ? [only] : []) : (await accounts(job)).filter(fresh(job))
  const work: Promise<void>[] = []
  if (c.nightly) for (const a of await pick("nightly", forNightly)) work.push(nightly(a.tool, a.profile, c.time))
  if (c.live) for (const a of await pick("live", forLive)) work.push(live(a.tool, a.profile, true))
  await Promise.all(work)
}

/** The first setup screen's answers: kept, and opening at login applied, since it needs no account. */
export function confirmChoices() {
  const s = useMachineSetup.getState()
  s.confirm()
  void useMachineRuns.getState().setAutostart(s.atLogin)
}

/**
 * Accounts exist only after a sign-in, so the nightly sync and serve are applied when one ends, and once more when the
 * setup is finished for accounts signed in before it (or in a terminal).
 */
export function useApplyChoices() {
  useEffect(() => {
    const offSignIn = useSignIn.subscribe((s, before) => {
      if (s.signedInAt === before.signedInAt) return
      for (const key of Object.keys(s.signedInAt)) {
        if (s.signedInAt[key] === before.signedInAt[key]) continue
        const [tool, profile] = key.split(":")
        if (tool && profile) void applyOn({ tool, profile })
      }
    })
    const offSetup = useOnboarding.subscribe((s, before) => {
      if (s.status === "done" && before.status !== "done") void applyOn(null)
    })
    return () => {
      offSignIn()
      offSetup()
    }
  }, [])
}
