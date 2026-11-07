import userEvent from "@testing-library/user-event"
import { expect, vi } from "vitest"
import { App } from "@/app/App"
import { ownerId, tools } from "@/domain/catalog"
import type { Preflight } from "@/domain/compat"
import { STEPS, type StepId } from "@/domain/onboarding-flow"
import { fixMessages } from "@/features/fix"
import { onboardingMessages } from "@/features/onboarding"
import { systemMessages, useNode } from "@/features/system"
import { progressMessages } from "@/features/tools"
import { useLanguage } from "@/i18n"
import type { Agent, SkillReport } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import type { InstallEvent, NodeEvent, Profile, Readiness } from "@/platform/schemas"
import { useAgents } from "@/shared/agents-store"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { act, render, screen, waitFor, within } from "@/testing/render"

/** The English catalogs, so a test names a button the way the interface does and survives a copy change. */
export const m = onboardingMessages.en
export const sm = systemMessages.en
export const pm = progressMessages.en
export const fm = fixMessages.en

const program = (path: string, version: string) => ({ path, version, ok: true, problem: null })
const absent = { path: null, version: null, ok: false, problem: "not found" }

export const readyComputer: Readiness = {
  os: "Linux",
  arch: "x86_64",
  node: program("~/.nvm/versions/node/v24.19.0/bin/node", "24.19.0"),
  npm: program("~/.nvm/versions/node/v24.19.0/bin/npm", "11.6.2"),
  pnpm: absent,
  npmPrefix: "~/.nvm/versions/node/v24.19.0",
  npmPrefixWritable: true,
  managed: null,
}

export const noNodeComputer: Readiness = {
  ...readyComputer,
  node: absent,
  npm: absent,
  npmPrefix: null,
  npmPrefixWritable: null,
}

type Pending = { onEvent: (e: InstallEvent) => void; resolve: () => void }

const unfinished = new Set<Map<string, Pending>>()

/**
 * Ends every install a test left running. The tools store runs one install at a time for the whole module, so one
 * left hanging would hold every later test's installs in the queue.
 */
export async function endInstalls() {
  useTools.setState({ sessions: {} })
  await act(async () => {
    for (const running of unfinished) {
      for (const run of running.values()) {
        run.onEvent({ event: "failed", reason: "cancelled", message: "", hint: null })
        run.resolve()
      }
      running.clear()
    }
    unfinished.clear()
    await new Promise((r) => setTimeout(r, 20))
  })
}

/**
 * Stands in for npm: each install waits until the test drives it, and the tools found on the computer follow what
 * finished. Lines are the `--loglevel http` ones `install-progress.ts` reads, so the bars move as they do for real.
 */
export function fakeInstaller(installed: Record<string, string> = {}) {
  const versions = new Map(Object.entries(installed))
  const running = new Map<string, Pending>()
  unfinished.add(running)
  const started: string[] = []
  vi.spyOn(platform, "detectTools").mockImplementation(async () =>
    tools.map((t) => {
      const version = versions.get(ownerId(t.id))
      return {
        id: t.id,
        installs: version ? [{ path: `~/.local/bin/${t.bin}`, version, manager: "npm", problem: null }] : [],
      }
    }),
  )
  vi.spyOn(platform, "install").mockImplementation(
    (id, onEvent) =>
      new Promise<void>((resolve) => {
        started.push(id)
        running.set(id, { onEvent, resolve })
      }),
  )
  vi.spyOn(platform, "cancelInstall").mockResolvedValue(undefined)

  const of = (id: string) => {
    const run = running.get(id)
    if (!run) throw new Error(`${id} is not installing`)
    return run
  }
  const send = (id: string, ...events: InstallEvent[]) =>
    act(() => {
      for (const e of events) of(id).onEvent(e)
    })
  const log = (line: string): InstallEvent => ({ event: "log", line, stderr: false })
  const tarball = (i: number) => `https://registry.npmjs.org/p${i}/-/p${i}-1.0.0.tgz`
  const end = async (id: string, e: InstallEvent) => {
    const run = of(id)
    running.delete(id)
    await act(async () => {
      run.onEvent(e)
      run.resolve()
    })
  }

  return {
    /** Ids in the order the store asked npm for them. */
    started,
    isRunning: (id: string) => running.has(id),
    /** Waits until the store has handed this tool to npm. */
    whenStarted: (id: string) => waitFor(() => expect(running.has(id)).toBe(true)),
    send,
    check: (id: string) => send(id, { event: "step", step: "check" }),
    /** npm starts and looks up `n` packages. */
    lookUp: (id: string, n: number) =>
      send(
        id,
        { event: "step", step: "install" },
        log(`$ npm install --global ${id}`),
        ...Array.from({ length: n }, (_, i) => log(`npm http fetch GET 200 https://registry.npmjs.org/p${i} 40ms`)),
      ),
    /** npm lists `total` packages to fetch and `done` of them land. */
    download: (id: string, done: number, total: number) =>
      send(
        id,
        ...Array.from({ length: total }, (_, i) => log(`npm http cache ${tarball(i)} (cache miss)`)),
        ...Array.from({ length: done }, (_, i) => log(`npm http fetch GET 200 ${tarball(i)} 40ms`)),
      ),
    added: (id: string, n: number) => send(id, log(`added ${n} packages in 4s`)),
    verify: (id: string) => send(id, { event: "step", step: "verify" }),
    /** `manual` is the PATH line the owner adds himself, for a shell WireCat does not edit. */
    async finish(id: string, version = "1.0.0", manual: string | null = null) {
      versions.set(id, version)
      const pathFix = manual ? { added: [], unreachable: [], file: null, manual, restart: true, shells: [] } : null
      await end(id, {
        event: "done",
        version,
        path: `~/.local/bin/${id}`,
        shadowedBy: null,
        skills: { refreshed: [], failed: null },
        pathFix,
      })
    },
    fail: (id: string, reason: string, message = "npm failed", hint: string | null = null) =>
      end(id, { event: "failed", reason, message, hint } as InstallEvent),
  }
}

export type FakeInstaller = ReturnType<typeof fakeInstaller>

/** Stands in for the managed Node.js setup: each phase arrives when the test sends it. */
export function fakeNodeSetup(computer: { current: Readiness | null }) {
  let onEvent: (e: NodeEvent) => void = () => {}
  let resolve = () => {}
  const setup = vi.spyOn(platform, "setupNode").mockImplementation(
    (send) =>
      new Promise<void>((r) => {
        onEvent = send
        resolve = r
      }),
  )
  const cancel = vi.spyOn(platform, "cancelNodeSetup").mockImplementation(async () => {
    onEvent({ event: "failed", reason: "cancelled", message: "Node.js setup cancelled.", hint: null })
    resolve()
  })
  const end = async (e: NodeEvent) => {
    await act(async () => {
      onEvent(e)
      resolve()
    })
  }
  return {
    setup,
    cancel,
    send: (...events: NodeEvent[]) =>
      act(() => {
        for (const e of events) onEvent(e)
      }),
    async finish() {
      computer.current = { ...readyComputer, managed: { version: "24.22.1", dir: "~/.local/share/node", active: true } }
      await end({ event: "done", version: "24.22.1", path: "~/.local/share/node", pathFix: null })
    },
    fail: (message: string, hint: string | null = null) => end({ event: "failed", reason: "verify", message, hint }),
  }
}

export const agent = (id: string, name: string, found = true): Agent => ({
  id,
  name,
  foundBy: found ? "program" : null,
  reads: ["claude"],
})

/** A skill report where each place agents read holds the tool's skill in `state`. */
export const skillIn = (state: "current" | "missing"): SkillReport => ({
  source: "status",
  targets: (["claude", "agents"] as const).map((target) => ({
    target,
    path: null,
    installed: state === "current" ? "1.0.0" : null,
    state,
  })),
})

type Start = {
  step?: StepId
  chosen?: string[]
  computer?: Readiness | null
  installed?: Record<string, string>
  agents?: Agent[]
  /**
   * `fresh` starts the app as on a first start, so the setup reads the computer before it shows a step; `later` as
   * after "Set up later" and a restart, with the setup closed until the owner presses Finish setup.
   */
  start?: "open" | "fresh" | "later"
  /** The furthest step reached in an earlier run. */
  reached?: StepId
  /** Each tool's accounts; tools not named have none. Only spied on when given. */
  profiles?: Record<string, Profile[] | null>
  /** Each tool's skill report; tools not named have no skill in any place. Only spied on when given. */
  skills?: Record<string, SkillReport>
  /** The store check's answer for each tool; tools not named move nothing and are not asked about. */
  preflight?: Record<string, Partial<Preflight>>
}

/**
 * Opens the first-run setup at `step` on a computer the test describes. Everything the setup asks the platform is
 * answered at once, so a test waits only for what it drives.
 */
export function startOnboarding({
  step = "welcome",
  chosen = [],
  computer = readyComputer,
  installed = {},
  agents = [],
  start = "open",
  reached = step,
  profiles,
  skills,
  preflight = {},
}: Start = {}) {
  localStorage.clear()
  useLanguage.setState({ choice: "en" })
  useNode.setState(useNode.getInitialState(), true)
  useAgents.setState(useAgents.getInitialState(), true)
  useTools.setState({ ...useTools.getInitialState(), sessions: {}, installs: {}, checked: false }, true)
  useSystem.setState({ readiness: computer, error: null })
  useOnboarding.setState({
    status: start === "later" ? "later" : "new",
    open: start !== "later",
    resuming: start === "fresh",
    step,
    reached,
    chosen,
  })

  const facts = { current: computer }
  vi.spyOn(platform, "readiness").mockImplementation(async () => facts.current ?? readyComputer)
  vi.spyOn(platform, "nodeOffer").mockResolvedValue({ version: "24.22.1", bytes: 58_290_700, dir: "~/.local/share/x" })
  vi.spyOn(platform, "detectAgents").mockResolvedValue(agents)
  if (profiles) vi.spyOn(platform, "listProfiles").mockImplementation(async (id) => profiles[id] ?? [])
  vi.spyOn(platform, "storePreflight").mockImplementation(async (id) => ({
    version: null,
    known: false,
    cannotOpen: null,
    alsoUpdate: [],
    stops: [],
    ...preflight[id],
  }))
  if (skills) vi.spyOn(platform, "skillStatus").mockImplementation(async (id) => skills[id] ?? skillIn("missing"))
  const npm = fakeInstaller(installed)
  const node = fakeNodeSetup(facts)
  const user = userEvent.setup()
  const view = render(<App />)
  return { user, npm, node, facts, view }
}

/** The setup step the sidebar marks as current. */
export function currentStep(): StepId {
  const nav = screen.getByRole("navigation", { name: m.flow.stepsNav })
  const here = within(nav)
    .getAllByRole("button")
    .find((b) => b.getAttribute("aria-current") === "step")
  const id = STEPS.find((s) => here?.textContent?.includes(m.steps[s]))
  if (!id) throw new Error("no current step in the sidebar")
  return id
}

export const sidebarStep = (step: StepId) =>
  within(screen.getByRole("navigation", { name: m.flow.stepsNav })).getByRole("button", {
    name: new RegExp(m.steps[step]),
  })

/** The main button at the foot of the step. */
export const primaryButton = (name: string) => screen.getByRole("button", { name })

/** A progress bar's value as a number. */
export function progressOf(bar: HTMLElement): number {
  const now = bar.getAttribute("aria-valuenow")
  if (now === null) throw new Error("the progress bar has no value")
  return Number(now)
}

export const overviewBar = () => screen.getByRole("progressbar", { name: m.wait.label })

/** The row of one tool in the Install step's list. */
export function installRow(name: string): HTMLElement {
  const list = screen.getByRole("list", { name: m.install.list })
  const row = within(list)
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes(name))
  if (!row) throw new Error(`no install row for ${name}`)
  return row
}

/** The bar inside a tool's row while it installs, or null once the row has folded it away. */
export const rowBar = (name: string) => within(installRow(name)).queryByRole("progressbar")
