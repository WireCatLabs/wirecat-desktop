import { ownerId } from "./catalog"
import type { InstallSession } from "./status"

/** The first-run setup, in the order the owner walks it. */
export const STEPS = ["welcome", "computer", "choose", "install", "agents", "signin", "done"] as const

export type StepId = (typeof STEPS)[number]

export const stepIndex = (step: StepId) => STEPS.indexOf(step)

const at = (i: number): StepId => STEPS[Math.max(0, Math.min(i, STEPS.length - 1))] as StepId

/** Where Continue goes. With nothing chosen there is nothing to install, so Choose goes straight to Agents. */
export function nextStep(step: StepId, chosen: number): StepId {
  if (step === "choose" && chosen === 0) return "agents"
  return at(stepIndex(step) + 1)
}

export const previousStep = (step: StepId): StepId | null => (step === "welcome" ? null : at(stepIndex(step) - 1))

/** Where Skip goes, or null where there is no Skip: Your computer is the Node.js gate, and skipping Choose skips Install. */
export function skipTarget(step: StepId): StepId | null {
  if (step === "welcome" || step === "computer" || step === "done") return null
  return step === "choose" ? "agents" : nextStep(step, 1)
}

/** The parts of the computer check the gate reads; `Readiness` from the platform fits it. */
export type Facts = {
  node: { ok: boolean }
  npm: { ok: boolean }
  npmPrefixWritable: boolean | null
}

/** Why the setup cannot go past Your computer yet, or null when it can. */
export type Gate = "checking" | "settingUp" | "node" | null

/**
 * Tools cannot install without Node.js and an npm that can write its global folder, so the setup holds at Your
 * computer until both are there, or the owner says he installs Node.js himself.
 */
export function computerGate(facts: Facts | null, settingUp: boolean, myself: boolean): Gate {
  if (myself) return null
  if (!facts) return "checking"
  if (facts.node.ok && facts.npm.ok && facts.npmPrefixWritable !== false) return null
  return settingUp ? "settingUp" : "node"
}

/** A step the sidebar may open: any step up to Your computer, and the ones after it once the gate is open. */
export const canOpen = (step: StepId, gate: Gate) => gate === null || stepIndex(step) <= stepIndex("computer")

export type Primary = "start" | "install" | "tour" | "continue"

/**
 * What the main button does: install the chosen tools only when there are some to install and Node.js can do it. Done
 * leads into the tour of the window, which ends on the first guide (owner, 2026-11-05: show the app before the guides).
 */
export function primaryAction(step: StepId, toInstall: number, nodeReady: boolean): Primary {
  if (step === "welcome") return "start"
  if (step === "done") return "tour"
  if (step === "choose" && toInstall > 0 && nodeReady) return "install"
  return "continue"
}

/** What the computer already has, read when the setup opens, so it starts where the owner stands. */
export type Progress = {
  /** The furthest step the owner opened before; a hint only, the computer's state wins. */
  reached: StepId
  nodeReady: boolean
  installed: number
  installing: boolean
  agentFound: boolean
  skillInAgent: boolean
  /** Installed tools that sign in and have no account signed in yet. */
  signedOut: number
}

export type Resume = StepId | "home"

/** Where the setup opens: the first thing still missing, or home once nothing is. */
export function resumeAt(p: Progress): Resume {
  if (p.installing) return "install"
  if (p.installed === 0) {
    // Node.js often comes with the computer; until the owner has gone past Welcome, that alone is not progress.
    if (p.reached === "welcome") return "welcome"
    return p.nodeReady ? "choose" : "computer"
  }
  if (!p.nodeReady) return "computer"
  if (p.agentFound && !p.skillInAgent) return "agents"
  if (p.signedOut > 0) return "signin"
  return "home"
}

export const furthest = (a: StepId, b: StepId): StepId => (stepIndex(a) >= stepIndex(b) ? a : b)

/**
 * Whether a tool has an account to work with. A tool set up by hand (`manual`) shows a listed account as ready; a
 * sign-in it cannot report (`signedIn: null`), a tool without accounts (`null`) or a listing that failed
 * (`undefined`) does not hold the setup, since the owner could not fix it there either.
 */
export function accountReady(
  profiles: readonly { signedIn: boolean | null }[] | null | undefined,
  manual: boolean,
): boolean {
  if (!profiles) return true
  if (manual) return profiles.length > 0
  return profiles.some((p) => p.signedIn !== false)
}

/** A skill is in place for an agent when its copy is there, current or older. */
export const skillInPlace = (kinds: readonly string[]) => kinds.some((k) => k === "current" || k === "stale")

/**
 * Where the Sign in step goes once a sign-in in the window has ended and its dialog closed: on to Done when every tool
 * there has an account (`accountReady`), or it stays for the ones left. `undefined` is a tool still reading its
 * accounts, which the answer waits for.
 */
export function afterSignIn(ready: readonly (boolean | undefined)[]): "done" | "stay" | "wait" {
  if (ready.some((r) => r === undefined)) return "wait"
  return ready.length > 0 && ready.every(Boolean) ? "done" : "stay"
}

export type RowPhase = "idle" | "wait" | "run" | "done" | "fail"

/** Where one tool stands in the Install step. */
export const installPhase = (session: InstallSession | undefined): RowPhase =>
  !session
    ? "idle"
    : session.outcome
      ? session.outcome.event === "failed"
        ? "fail"
        : "done"
      : session.step === "queued"
        ? "wait"
        : "run"

type Installs = Record<string, readonly { version: string | null }[] | undefined>
type Sessions = Record<string, InstallSession | undefined>

/** The chosen tools to queue now: not on the computer with a working copy, and not already installing. */
export const toQueue = (ids: readonly string[], installs: Installs, sessions: Sessions) =>
  ids.filter((id) => !installs[id]?.[0]?.version && !sessions[ownerId(id)])

const settled = (id: string, sessions: Sessions) => !sessions[ownerId(id)] || !!sessions[ownerId(id)]?.outcome

/** What the Install step's controls and closing note read from the chosen tools. */
export function installOverview(chosen: readonly string[], installs: Installs, sessions: Sessions) {
  return {
    pending: chosen.some((id) => !installs[id]?.length && !sessions[ownerId(id)]),
    allDone:
      chosen.length > 0 && chosen.every((id) => installs[id]?.length) && chosen.every((id) => settled(id, sessions)),
    settledWithOne:
      chosen.some((id) => sessions[ownerId(id)]?.outcome?.event === "done") &&
      chosen.every((id) => settled(id, sessions)),
  }
}

/** The command an installed tool leaves for the owner when its folder could not be put on the PATH. */
export function restartCommand(chosen: readonly string[], sessions: Sessions): string | null {
  for (const id of chosen) {
    const outcome = sessions[ownerId(id)]?.outcome
    if (outcome?.event === "done" && outcome.pathFix?.manual) return outcome.pathFix.manual
  }
  return null
}

/** The tools this setup is about: the ones chosen in this flow and the ones already on the computer. */
export const setupTools = <T extends { id: string }>(
  all: readonly T[],
  chosen: readonly string[],
  installs: Installs,
) => all.filter((t) => chosen.includes(t.id) || installs[t.id]?.length)

type Signing = { setup?: unknown; signIn?: { command?: unknown } | null | undefined }

/** A tool the Sign in step has something to do for. */
export const signsIn = (t: Signing) => Boolean(t.setup || t.signIn?.command)

/** The Sign in step's three lists: tools to sign in now, installed later, and tools with no sign-in at all. */
export function signInGroups<T extends Signing & { id: string }>(list: readonly T[], installs: Installs) {
  return {
    ready: list.filter((t) => signsIn(t) && installs[t.id]?.length),
    waiting: list.filter((t) => signsIn(t) && !installs[t.id]?.length),
    noSignIn: list.filter((t) => !signsIn(t)),
  }
}

type Program = { ok: boolean; version: string | null; problem: string | null }

export type ComputerCheck = {
  program: "node" | "npm"
  found: boolean
  version: string | null
  tone: "ok" | "bad"
  note: string | null
}

/** One line of the Your computer step, for Node.js or npm; null until the check has run. */
export const computerLine = (program: "node" | "npm", p: Program | undefined): ComputerCheck | null =>
  p
    ? {
        program,
        found: p.version !== null,
        version: p.version,
        tone: p.ok ? "ok" : "bad",
        note: p.version ? p.problem : null,
      }
    : null

/** The version a Done row shows and what runs beside it: an install of this flow still in progress. */
export function doneRow(version: string | null | undefined, session: InstallSession | undefined) {
  const running = session && !session.outcome && session.operation === "install" ? session : null
  return { running, tone: version ? "ok" : running ? "busy" : "idle" } as const
}
