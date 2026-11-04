import { describe, expect, it } from "vitest"
import {
  canOpen,
  computerGate,
  type Facts,
  nextStep,
  previousStep,
  primaryAction,
  STEPS,
  skipTarget,
} from "./onboarding-flow"

const ready: Facts = { node: { ok: true }, npm: { ok: true }, npmPrefixWritable: true }
const noNode: Facts = { node: { ok: false }, npm: { ok: false }, npmPrefixWritable: null }

describe("the order of the setup", () => {
  it("walks welcome, computer, choose, install, agents, sign in, done", () => {
    expect(STEPS).toEqual(["welcome", "computer", "choose", "install", "agents", "signin", "done"])
    const walked: string[] = ["welcome"]
    while (walked.at(-1) !== "done") walked.push(nextStep(walked.at(-1) as (typeof STEPS)[number], 1))
    expect(walked).toEqual([...STEPS])
  })

  it("goes from Choose straight to Agents when nothing is chosen", () => {
    expect(nextStep("choose", 0)).toBe("agents")
    expect(nextStep("choose", 2)).toBe("install")
  })

  it("stays on Done and has no step before Welcome", () => {
    expect(nextStep("done", 1)).toBe("done")
    expect(previousStep("welcome")).toBeNull()
    expect(previousStep("agents")).toBe("install")
  })
})

describe("Skip", () => {
  it("is not offered on Welcome, Your computer or Done", () => {
    expect(skipTarget("welcome")).toBeNull()
    expect(skipTarget("computer")).toBeNull()
    expect(skipTarget("done")).toBeNull()
  })

  it("skips Install along with Choose, and goes one step on elsewhere", () => {
    expect(skipTarget("choose")).toBe("agents")
    expect(skipTarget("install")).toBe("agents")
    expect(skipTarget("agents")).toBe("signin")
    expect(skipTarget("signin")).toBe("done")
  })
})

describe("the Node.js gate", () => {
  it("holds while the computer is checked, while Node.js is set up, and without Node.js", () => {
    expect(computerGate(null, false, false)).toBe("checking")
    expect(computerGate(noNode, true, false)).toBe("settingUp")
    expect(computerGate(noNode, false, false)).toBe("node")
  })

  it("holds when npm cannot write its global folder", () => {
    expect(computerGate({ ...ready, npmPrefixWritable: false }, false, false)).toBe("node")
    expect(computerGate({ ...ready, npmPrefixWritable: null }, false, false)).toBeNull()
  })

  it("opens once Node.js is ready, or the owner installs it himself", () => {
    expect(computerGate(ready, false, false)).toBeNull()
    expect(computerGate(noNode, false, true)).toBeNull()
    expect(computerGate(null, false, true)).toBeNull()
  })

  it("lets the sidebar open nothing past Your computer while it holds", () => {
    const open = (gate: Parameters<typeof canOpen>[1]) => STEPS.filter((s) => canOpen(s, gate))
    expect(open("node")).toEqual(["welcome", "computer"])
    expect(open("checking")).toEqual(["welcome", "computer"])
    expect(open(null)).toEqual([...STEPS])
  })
})

describe("the main button", () => {
  it("installs on Choose only with tools to install and Node.js ready", () => {
    expect(primaryAction("choose", 2, true)).toBe("install")
    expect(primaryAction("choose", 2, false)).toBe("continue")
    expect(primaryAction("choose", 0, true)).toBe("continue")
  })

  it("starts on Welcome and leads to the guides on Done", () => {
    expect(primaryAction("welcome", 0, false)).toBe("start")
    expect(primaryAction("done", 0, true)).toBe("guides")
    expect(primaryAction("install", 3, true)).toBe("continue")
  })
})
