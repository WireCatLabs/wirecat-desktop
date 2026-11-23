import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isCommunity, tools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { endInstalls, fakeInstaller, readyComputer } from "@/testing/onboarding"
import { render, screen, waitFor } from "@/testing/render"
import { InstallAll } from "./InstallAll"

const official = tools.filter((t) => !isCommunity(t) && !t.partOf).map((t) => t.id)
const copy = [{ path: "~/.local/bin/x", version: "1.0.0", manager: "npm" as const, problem: null }]
const machine = (installed: readonly string[]) =>
  useTools.setState({
    checked: true,
    sessions: {},
    installs: Object.fromEntries(official.map((id) => [id, installed.includes(id) ? copy : []])),
  })

beforeEach(() => {
  useSystem.setState({ readiness: readyComputer, error: null })
  vi.spyOn(platform, "storePreflight").mockResolvedValue(undefined as never)
})
afterEach(async () => {
  await endInstalls()
  vi.restoreAllMocks()
})

describe("Install all on the Tools page", () => {
  it("counts the tools not installed yet", () => {
    machine(official.slice(2))
    render(<InstallAll />)
    expect(screen.getByRole("button", { name: "Install all (2)" })).toBeInTheDocument()
  })

  it("is not there when every tool is installed", () => {
    machine(official)
    render(<InstallAll />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("installs each missing tool once, one after another", async () => {
    const user = userEvent.setup()
    const npm = fakeInstaller(Object.fromEntries(official.slice(2).map((id) => [id, "1.0.0"])))
    const [first = "", second = ""] = official
    machine(official.slice(2))
    render(<InstallAll />)

    const button = screen.getByRole("button", { name: "Install all (2)" })
    await user.click(button)
    await npm.whenStarted(first)
    await user.click(button)
    expect(button).toHaveTextContent("Installing…")
    expect(npm.isRunning(second)).toBe(false)

    await npm.finish(first)
    await npm.whenStarted(second)
    await npm.finish(second)
    expect(npm.started).toEqual([first, second])
    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument())
  })

  it("keeps each row's panel shut, and opens the one that fails", async () => {
    const user = userEvent.setup()
    const npm = fakeInstaller()
    const [first = "", second = ""] = official
    machine(official.slice(2))
    render(<InstallAll />)

    await user.click(screen.getByRole("button", { name: "Install all (2)" }))
    await npm.whenStarted(first)
    expect(useTools.getState().sessions[second]?.closed).toEqual([second])

    await npm.fail(first, "failed")
    expect(useTools.getState().sessions[first]?.closed).toEqual([])
  })
})

describe("Update all on the Tools page", () => {
  const old = [{ ...copy[0], version: "0.1.0" }] as typeof copy
  const outdated = (ids: readonly string[]) =>
    useTools.setState({
      checked: true,
      sessions: {},
      installs: Object.fromEntries(official.map((id) => [id, ids.includes(id) ? old : copy])),
      latest: Object.fromEntries(official.map((id) => [id, "1.0.0"])),
    })

  it("counts the installed tools with a newer version and updates each, one after another", async () => {
    const user = userEvent.setup()
    const [first = "", second = ""] = official
    const npm = fakeInstaller({ [first]: "1.0.0", [second]: "1.0.0" })
    outdated([first, second])
    render(<InstallAll />)

    await user.click(screen.getByRole("button", { name: "Update all (2)" }))
    await npm.whenStarted(first)
    expect(screen.getByRole("button", { name: /Updating…/ })).toBeInTheDocument()
    await npm.finish(first)
    await npm.whenStarted(second)
    await npm.finish(second)
    expect(npm.started).toEqual([first, second])
  })

  it("keeps each row's panel shut while it updates", async () => {
    const user = userEvent.setup()
    const [first = "", second = ""] = official
    const npm = fakeInstaller({ [first]: "1.0.0", [second]: "1.0.0" })
    outdated([first, second])
    render(<InstallAll />)

    await user.click(screen.getByRole("button", { name: "Update all (2)" }))
    await npm.whenStarted(first)
    expect(useTools.getState().sessions[first]?.closed).toEqual([first])
    expect(useTools.getState().sessions[second]?.closed).toEqual([second])
  })

  it("is not there while npm has not answered, nor when every tool is current", () => {
    outdated([])
    const { unmount } = render(<InstallAll />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    unmount()
    useTools.setState({ latest: null, installs: Object.fromEntries(official.map((id) => [id, old])) })
    render(<InstallAll />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
