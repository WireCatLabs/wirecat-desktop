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
