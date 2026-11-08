import { expect, it } from "vitest"
import { ownReviewMessages } from "./messages-own-review"
import { signalWords } from "./own-signals"

const m = ownReviewMessages.en.signals

it("names the first undeclared hosts and counts the rest", () => {
  const [what] = signalWords({ kind: "undeclaredHosts", hosts: ["a.io", "b.io"], more: 3 }, m)
  expect(what).toBe("Its code names servers it does not declare: a.io, b.io, and 3 more")
})

it("says a bundled cli-core's version is unknown, and that native code cannot be read", () => {
  expect(signalWords({ kind: "bundledUnknown", package: "@wirecat/cli-core" }, m)[0]).toBe(
    "It bundles cli-core (version unknown)",
  )
  expect(signalWords({ kind: "nativeCode", files: ["build/a.node"] }, m)[1]).toMatch(/cannot read them/)
})

it("says cli-core's checks cover only what an untrusted tool sends through them", () => {
  expect(signalWords({ kind: "coreOutOfRange", found: null, min: "0.603.0" }, m)[1]).toMatch(
    /run only if the tool uses cli-core, and this one doesn't/,
  )
})

it("names hidden calls in plain words and where a repository moved", () => {
  expect(signalWords({ kind: "hiddenCalls", ways: ["computed global"] }, m)[0]).toBe(
    "Its code hides calls: a global looked up by a computed name",
  )
  expect(signalWords({ kind: "repoMoved", to: "acme/crm-next" }, m)[0]).toBe("Its repository moved to acme/crm-next")
})

it("says a file that is not JavaScript is loaded as code", () => {
  expect(signalWords({ kind: "loadsNonJs", paths: ["dist/logo.png"] }, m)[0]).toBe(
    "It loads a file that isn't JavaScript as code: dist/logo.png",
  )
})
