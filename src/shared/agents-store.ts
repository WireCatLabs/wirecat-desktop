import { create } from "zustand"
import type { SkillTarget } from "@/domain/skills"
import type { Agent, SkillReport } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"

type ToolSkill = { report: SkillReport | null; error: string | null }

type AgentsState = {
  agents: Agent[] | null
  agentsError: string | null
  /** By tool id; absent while that tool is being asked. */
  skills: Record<string, ToolSkill>
  /** `<tool>:<target>` → the version an install in this session wrote. */
  written: Record<string, string | null>
  busy: Record<string, boolean>
  failures: Record<string, string>
  /** Asking again; the last answers stay on screen meanwhile. */
  refreshing: boolean
  /** Every tool answered once this session; the page asks for logs and claims only after, so skills come first. */
  answered: boolean
  /** When `load` last asked, and for which tools; the Agents page opened again within a minute asks nothing. */
  answeredAt: number | null
  answeredFor: string
  /** Finds the agents only, once; for pages that start an agent and need no skills. */
  detect(): Promise<void>
  /** Asks every installed tool at once; each row fills in as its tool answers. */
  load(installed: readonly string[]): Promise<void>
  install(id: string, target: SkillTarget): Promise<void>
  /** One at a time: each install is a separate process writing to the same folders. */
  installAll(cells: readonly [string, SkillTarget][]): Promise<void>
  /** After the tool itself was updated: its copies and its version changed under the answers kept here. */
  recheck(id: string): Promise<void>
}

export const cellKey = (id: string, target: SkillTarget) => `${id}:${target}`

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Every guide on the page asks at once; one question answers them all.
let detecting: Promise<void> | null = null

/** The install itself, for a cell already marked busy; clears the mark when done. */
async function write(id: string, target: SkillTarget) {
  const key = cellKey(id, target)
  const set = useAgents.setState
  set((s) => ({ failures: without(s.failures, key) }))
  try {
    const version = await platform.skillInstall(id, target)
    set((s) => ({ written: { ...s.written, [key]: version } }))
    const report = await platform.skillStatus(id).catch(() => null)
    if (report) set((s) => ({ skills: { ...s.skills, [id]: { report, error: null } } }))
  } catch (e) {
    set((s) => ({ failures: { ...s.failures, [key]: message(e) } }))
  } finally {
    set((s) => ({ busy: without(s.busy, key) }))
  }
}

export const useAgents = create<AgentsState>((set, get) => ({
  agents: null,
  agentsError: null,
  skills: {},
  written: {},
  busy: {},
  failures: {},
  refreshing: false,
  answered: false,
  answeredAt: null,
  answeredFor: "",

  async detect() {
    if (get().agents !== null) return
    detecting ??= platform
      .detectAgents()
      .then((agents) => set({ agents, agentsError: null }))
      .catch((e) => set({ agents: [], agentsError: message(e) }))
      .finally(() => {
        detecting = null
      })
    await detecting
  },

  async load(installed) {
    // A failed install stays until that cell is retried: asking again must not erase what the user has not acted on.
    // Stamped when asked, so an answer that lands after a reset does not pass for a fresh one.
    set({ refreshing: true, answeredAt: Date.now(), answeredFor: installed.join(",") })
    const agents = platform
      .detectAgents()
      .then((agents) => set({ agents, agentsError: null }))
      .catch((e) => set({ agents: [], agentsError: message(e) }))
    const skills = installed.map((id) =>
      platform
        .skillStatus(id)
        .then((report) => ({ report, error: null }))
        .catch((e) => ({ report: null, error: message(e) }))
        .then((result) => set((s) => ({ skills: { ...s.skills, [id]: result } }))),
    )
    await Promise.all([agents, ...skills])
    set({ refreshing: false, answered: true })
  },

  async install(id, target) {
    const key = cellKey(id, target)
    if (get().busy[key]) return
    set((s) => ({ busy: { ...s.busy, [key]: true } }))
    await write(id, target)
  },

  // Every cell is busy from the start, so one still waiting its turn offers no Install of its own meanwhile.
  async installAll(cells) {
    const todo = cells.filter(([id, target]) => !get().busy[cellKey(id, target)])
    set((s) => ({ busy: { ...s.busy, ...Object.fromEntries(todo.map(([id, t]) => [cellKey(id, t), true])) } }))
    for (const [id, target] of todo) await write(id, target)
  },

  async recheck(id) {
    set((s) => ({
      written: Object.fromEntries(Object.entries(s.written).filter(([key]) => !key.startsWith(`${id}:`))),
    }))
    const agents =
      get().agents === null
        ? platform
            .detectAgents()
            .then((agents) => set({ agents, agentsError: null }))
            .catch(() => undefined)
        : undefined
    const skills = platform
      .skillStatus(id)
      .then((report) => set((s) => ({ skills: { ...s.skills, [id]: { report, error: null } } })))
      .catch(() => undefined)
    await Promise.all([agents, skills])
  },
}))

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = map
  return rest
}
