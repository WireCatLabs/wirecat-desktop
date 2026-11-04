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

export type Primary = "start" | "install" | "guides" | "continue"

/** What the main button does: install the chosen tools only when there are some to install and Node.js can do it. */
export function primaryAction(step: StepId, toInstall: number, nodeReady: boolean): Primary {
  if (step === "welcome") return "start"
  if (step === "done") return "guides"
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
