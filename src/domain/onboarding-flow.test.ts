import { describe, expect, it } from "vitest"
import {
  accountReady,
  afterSignIn,
  canOpen,
  computerGate,
  computerLine,
  doneRow,
  type Facts,
  furthest,
  installOverview,
  installPhase,
  nextStep,
  type Progress,
  previousStep,
  primaryAction,
  restartCommand,
  resumeAt,
  STEPS,
  setupTools,
  signInGroups,
  signsIn,
  skillInPlace,
  skipTarget,
  toQueue,
} from "./onboarding-flow"
import type { InstallSession } from "./status"

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

  it("starts on Welcome and leads into the tour on Done", () => {
    expect(primaryAction("welcome", 0, false)).toBe("start")
    expect(primaryAction("done", 0, true)).toBe("tour")
    expect(primaryAction("install", 3, true)).toBe("continue")
  })
})

describe("where the setup opens", () => {
  const done: Progress = {
    reached: "done",
    nodeReady: true,
    installed: 2,
    installing: false,
    agentFound: true,
    skillInAgent: true,
    signedOut: 0,
  }
  const fresh: Progress = {
    reached: "welcome",
    nodeReady: false,
    installed: 0,
    installing: false,
    agentFound: false,
    skillInAgent: false,
    signedOut: 0,
  }

  it("opens at Welcome when nothing is done yet, with or without Node.js", () => {
    expect(resumeAt(fresh)).toBe("welcome")
    expect(resumeAt({ ...fresh, nodeReady: true })).toBe("welcome")
    expect(resumeAt({ ...fresh, nodeReady: true, agentFound: true })).toBe("welcome")
  })

  it("opens at Your computer when the owner went past Welcome and Node.js is missing", () => {
    expect(resumeAt({ ...fresh, reached: "computer" })).toBe("computer")
    expect(resumeAt({ ...fresh, reached: "signin" })).toBe("computer")
  })

  it("opens at Choose when Node.js is ready and no tool is installed", () => {
    expect(resumeAt({ ...fresh, reached: "computer", nodeReady: true })).toBe("choose")
    expect(resumeAt({ ...done, installed: 0 })).toBe("choose")
  })

  it("opens at Install while an install runs, whatever else is true", () => {
    expect(resumeAt({ ...fresh, installing: true })).toBe("install")
    expect(resumeAt({ ...done, installing: true })).toBe("install")
    expect(resumeAt({ ...done, installing: true, signedOut: 2, skillInAgent: false })).toBe("install")
  })

  it("opens at Your computer when tools are installed but Node.js is gone", () => {
    expect(resumeAt({ ...done, nodeReady: false })).toBe("computer")
    expect(resumeAt({ ...done, nodeReady: false, reached: "welcome" })).toBe("computer")
  })

  it("opens at Agents when an agent is found and no tool's skill is in it", () => {
    expect(resumeAt({ ...done, skillInAgent: false })).toBe("agents")
    expect(resumeAt({ ...done, skillInAgent: false, signedOut: 1 })).toBe("agents")
  })

  it("skips Agents when no agent is found", () => {
    expect(resumeAt({ ...done, agentFound: false, skillInAgent: false })).toBe("home")
    expect(resumeAt({ ...done, agentFound: false, skillInAgent: false, signedOut: 1 })).toBe("signin")
  })

  it("opens at Sign in when an installed tool has no account signed in", () => {
    expect(resumeAt({ ...done, signedOut: 1 })).toBe("signin")
    expect(resumeAt({ ...done, signedOut: 1, reached: "welcome" })).toBe("signin")
  })

  it("goes home when everything is done, even on a first start", () => {
    expect(resumeAt(done)).toBe("home")
    expect(resumeAt({ ...done, reached: "welcome" })).toBe("home")
  })

  it("keeps the furthest step as the hint", () => {
    expect(furthest("welcome", "choose")).toBe("choose")
    expect(furthest("signin", "computer")).toBe("signin")
  })
})

describe("whether a tool has an account to work with", () => {
  it("needs one account not signed out", () => {
    expect(accountReady([], false)).toBe(false)
    expect(accountReady([{ signedIn: false }], false)).toBe(false)
    expect(accountReady([{ signedIn: false }, { signedIn: true }], false)).toBe(true)
  })

  it("does not hold the setup for what the tool cannot tell", () => {
    expect(accountReady([{ signedIn: null }], false)).toBe(true)
    expect(accountReady(null, false)).toBe(true)
    expect(accountReady(undefined, false)).toBe(true)
  })

  it("takes any listed account of a tool set up by hand", () => {
    expect(accountReady([], true)).toBe(false)
    expect(accountReady([{ signedIn: false }], true)).toBe(true)
  })

  it("counts a current or older skill copy as in place", () => {
    expect(skillInPlace(["missing", "stale"])).toBe(true)
    expect(skillInPlace(["current"])).toBe(true)
    expect(skillInPlace(["missing", "unknown", "checking"])).toBe(false)
  })
})

describe("after a sign-in in the window", () => {
  it("goes on to Done once every tool on the step has an account", () => {
    expect(afterSignIn([true, true])).toBe("done")
  })

  it("stays while a tool still has no account", () => {
    expect(afterSignIn([true, false])).toBe("stay")
    expect(afterSignIn([])).toBe("stay")
  })

  it("waits for a tool that is still reading its accounts", () => {
    expect(afterSignIn([true, undefined])).toBe("wait")
  })
})

const session = (over: Partial<InstallSession> = {}): InstallSession => ({
  operation: "install",
  step: "install",
  log: [],
  outcome: null,
  ...over,
})
const done = session({ outcome: { event: "done", version: "1.0.0", path: "/p", shadowedBy: null } })
const failed = session({ outcome: { event: "failed", reason: "network", message: "no", hint: null } })

describe("the Install step", () => {
  it("reads a row's phase from its session", () => {
    expect(installPhase(undefined)).toBe("idle")
    expect(installPhase(session({ step: "queued" }))).toBe("wait")
    expect(installPhase(session({ step: "preflight" }))).toBe("wait")
    expect(installPhase(session())).toBe("run")
    expect(installPhase(done)).toBe("done")
    expect(installPhase(failed)).toBe("fail")
  })

  it("queues only tools without a working copy or a session", () => {
    const installs = { tg: [{ version: "1.0.0" }], max: [{ version: null }], wa: undefined, zm: undefined }
    expect(toQueue(["tg", "max", "wa", "zm"], installs, { zm: session() })).toEqual(["max", "wa"])
  })

  it("tells pending, all done and settled with one", () => {
    const installs = { tg: [{ version: "1.0.0" }], wa: [] }
    expect(installOverview(["tg", "wa"], installs, {})).toEqual({
      pending: true,
      allDone: false,
      settledWithOne: false,
    })
    expect(installOverview(["tg"], installs, {})).toEqual({ pending: false, allDone: true, settledWithOne: false })
    expect(installOverview(["tg"], installs, { tg: session() }).allDone).toBe(false)
    expect(installOverview(["tg"], installs, { tg: done })).toEqual({
      pending: false,
      allDone: true,
      settledWithOne: true,
    })
    expect(installOverview(["tg", "wa"], installs, { tg: done, wa: failed }).settledWithOne).toBe(true)
    expect(installOverview([], {}, {}).allDone).toBe(false)
  })

  it("hands over the manual PATH command of the first install that has one", () => {
    const withFix = session({
      outcome: {
        event: "done",
        version: "1",
        path: "/p",
        shadowedBy: null,
        pathFix: { added: [], unreachable: [], file: null, manual: "export PATH=x", restart: true },
      },
    })
    expect(restartCommand(["tg", "wa"], { tg: done, wa: withFix })).toBe("export PATH=x")
    expect(restartCommand(["tg"], { tg: done })).toBeNull()
  })
})

describe("the tools a setup is about", () => {
  const all = [{ id: "tg" }, { id: "wa" }, { id: "zm" }]

  it("are the chosen ones and the ones already installed", () => {
    expect(setupTools(all, ["tg"], { wa: [{ version: "1" }], zm: [] }).map((t) => t.id)).toEqual(["tg", "wa"])
  })

  it("split by what the Sign in step can do", () => {
    const list = [{ id: "a", setup: {} }, { id: "b", signIn: { command: "x" } }, { id: "c", signIn: {} }, { id: "d" }]
    expect(list.map(signsIn)).toEqual([true, true, false, false])
    const g = signInGroups(list, { a: [{ version: "1" }] })
    expect(g.ready.map((t) => t.id)).toEqual(["a"])
    expect(g.waiting.map((t) => t.id)).toEqual(["b"])
    expect(g.noSignIn.map((t) => t.id)).toEqual(["c", "d"])
  })
})

describe("the Your computer and Done rows", () => {
  it("shows nothing before the check, then version, tone and note", () => {
    expect(computerLine("node", undefined)).toBeNull()
    expect(computerLine("node", { ok: true, version: "22.1.0", problem: null })).toEqual({
      program: "node",
      found: true,
      version: "22.1.0",
      tone: "ok",
      note: null,
    })
    expect(computerLine("npm", { ok: false, version: "9.0.0", problem: "old" })).toMatchObject({
      tone: "bad",
      note: "old",
    })
    expect(computerLine("npm", { ok: false, version: null, problem: "missing" })).toMatchObject({
      found: false,
      note: null,
    })
  })

  it("lights a Done row by version, then by a running install", () => {
    expect(doneRow("1.0.0", undefined).tone).toBe("ok")
    expect(doneRow(undefined, session()).tone).toBe("busy")
    expect(doneRow(undefined, session({ operation: "remove" as never })).tone).toBe("idle")
    expect(doneRow(undefined, done)).toEqual({ running: null, tone: "idle" })
  })
})
