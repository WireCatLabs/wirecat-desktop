import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "@/app/App"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { InstallEvent } from "@/platform/schemas"
import { useSystem } from "../system/store"
import { useTools } from "../tools/store"
import { useOnboarding } from "./store"

const absent = { path: null, version: null, ok: false, problem: "not found" }
const noNode = {
  os: "Linux",
  arch: "x86_64",
  node: absent,
  npm: absent,
  pnpm: absent,
  npmPrefix: null,
  npmPrefixWritable: null,
  managed: null,
}

const tarball = (name: string) => `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`

/** An install that reached "1 of 4 packages downloaded" and holds there until the test lets it finish. */
function holdInstall() {
  let finish = () => {}
  vi.spyOn(platform, "install").mockImplementation(async (_id, onEvent: (e: InstallEvent) => void) => {
    onEvent({ event: "step", step: "install" })
    onEvent({ event: "log", line: "$ npm install --global @wirecat/drive-cli@1.0.0", stderr: false })
    for (const n of ["a", "b", "c", "d"])
      onEvent({ event: "log", line: `npm http cache ${tarball(n)} (cache miss)`, stderr: false })
    onEvent({ event: "log", line: `npm http fetch GET 200 ${tarball("a")} 40ms`, stderr: false })
    await new Promise<void>((resolve) => {
      finish = resolve
    })
    onEvent({ event: "done", version: "1.0.0", path: "~/.local/bin/drive", shadowedBy: null })
  })
  return () => act(() => finish())
}

beforeEach(() => {
  localStorage.clear()
  useLanguage.setState({ choice: "en" })
  useTools.setState({ sessions: {} })
})

afterEach(() => vi.restoreAllMocks())

describe("the Your computer step", () => {
  beforeEach(() => {
    vi.spyOn(platform, "nodeOffer").mockResolvedValue({ version: "24.19.0", bytes: null, dir: "~/.local/share/x" })
    useSystem.setState({ readiness: noNode })
    useOnboarding.setState({ status: "new", open: true, step: "computer", chosen: [] })
  })

  it("holds Continue without Node.js, says why, and lets the owner go on once he installs it himself", async () => {
    const user = userEvent.setup()
    render(<App />)

    const next = screen.getByRole("button", { name: "Continue" })
    expect(next).toHaveAttribute("aria-disabled", "true")
    expect(next).toHaveAccessibleDescription(/Set up Node.js/)
    await user.click(next)
    expect(useOnboarding.getState().step).toBe("computer")
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "I'll install it myself" }))
    expect(next).not.toHaveAttribute("aria-disabled")
    await user.click(next)
    expect(useOnboarding.getState().step).toBe("choose")
  })
})

describe("an install that is still running", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "new", open: true, step: "install", chosen: ["drive"] })
  })

  it("shows the same figure in its row as in the overview, and what npm is doing", async () => {
    const finish = holdInstall()
    render(<App />)
    act(() => {
      void useTools.getState().install("drive")
    })

    const row = await screen.findByRole("region", { name: "Install progress" })
    const own = within(row).getByRole("progressbar")
    const overall = screen.getByRole("progressbar", { name: "Progress of all installs" })
    await waitFor(() => expect(own).toHaveAttribute("aria-valuenow", "49"))
    expect(overall).toHaveAttribute("aria-valuenow", own.getAttribute("aria-valuenow"))
    expect(within(row).getByText("Downloading 1 of 4 packages")).toBeInTheDocument()
    await finish()
    await waitFor(() => expect(useTools.getState().sessions.drive?.outcome?.event).toBe("done"))
  })

  it("stays visible on later steps and on the Tools page, and finishes there", async () => {
    const finish = holdInstall()
    const user = userEvent.setup()
    render(<App />)
    act(() => {
      void useTools.getState().install("drive")
    })

    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByText("Still installing: Google Drive 49%")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Set up later" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
    const bar = await screen.findByRole("progressbar", { name: "Installing Google Drive" })
    expect(bar).toHaveAttribute("aria-valuenow", "49")

    await finish()
    await waitFor(() => expect(useTools.getState().sessions.drive?.outcome?.event).toBe("done"))
    expect(screen.queryByRole("progressbar", { name: "Installing Google Drive" })).not.toBeInTheDocument()
  })
})

describe("the last step", () => {
  it("says other tools can be installed later on the Tools page", () => {
    useOnboarding.setState({ status: "new", open: true, step: "done", chosen: [] })
    render(<App />)
    expect(screen.getByText("You can install other tools later on the Tools page.")).toBeInTheDocument()
  })
})
