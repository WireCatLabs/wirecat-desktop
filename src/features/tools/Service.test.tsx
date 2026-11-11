import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Background } from "@/platform/sync-schemas"
import { render, screen, within } from "@/testing/render"
import { Service } from "./Service"

const wa = findTool("wa") as NonNullable<ReturnType<typeof findTool>>
const stopped = (over: Partial<Extract<Background, { state: "stopped" }>> = {}): Background => ({
  state: "stopped",
  unit: false,
  startsAtLogin: null,
  stoppedFor: null,
  ...over,
})

beforeEach(() => {
  vi.spyOn(platform, "listProfiles").mockResolvedValue([
    { name: "personal", signedIn: true },
    { name: "work", signedIn: true },
  ] as Awaited<ReturnType<typeof platform.listProfiles>>)
})
afterEach(() => vi.restoreAllMocks())

const row = async (name: string) => within(await screen.findByRole("listitem", { name: new RegExp(name) }))

describe("a messenger's background service", () => {
  it("lists every profile, says why it matters, and starts one with the tool's own commands", async () => {
    vi.spyOn(platform, "backgroundStatus").mockImplementation(async (_id, profile) =>
      profile === "personal" ? { state: "running", connected: true, startsAtLogin: true } : stopped(),
    )
    const run = vi.spyOn(platform, "backgroundRun").mockResolvedValue({
      state: { state: "running", connected: true, startsAtLogin: true },
      fault: null,
    })
    render(<Service tool={wa} />)
    expect(screen.getByText(/Keep your phone online/)).toBeInTheDocument()
    const work = await row("work")
    expect(await work.findByText(/Stopped/)).toBeInTheDocument()
    await userEvent.click(work.getByRole("button", { name: "Start and keep running" }))
    expect(run).toHaveBeenCalledWith("wa", "work", "keep")
    expect(await screen.findByText(/WhatsApp now runs in the background/)).toBeInTheDocument()
    expect((await row("personal")).getByRole("button", { name: "Stop" })).toBeInTheDocument()
  })

  it("offers to stop starting at login only for a service that does start at login", async () => {
    vi.spyOn(platform, "backgroundStatus").mockImplementation(async (_id, profile) =>
      stopped({ unit: true, startsAtLogin: profile === "personal" }),
    )
    render(<Service tool={wa} />)
    const personal = await row("personal")
    expect(await personal.findByRole("button", { name: "Stop starting at login" })).toBeInTheDocument()
    const work = await row("work")
    expect(await work.findByRole("button", { name: "Start and keep running" })).toBeInTheDocument()
    expect(work.queryByRole("button", { name: "Stop starting at login" })).not.toBeInTheDocument()
  })

  it("says a missing service manager in plain words and offers to run it for now, without administrator rights", async () => {
    vi.spyOn(platform, "backgroundStatus").mockResolvedValue(stopped())
    const run = vi.spyOn(platform, "backgroundRun").mockResolvedValueOnce({
      state: stopped(),
      fault: { kind: "managerMissing", message: "systemctl --user enable x failed" },
    })
    render(<Service tool={wa} />)
    await userEvent.click(await (await row("personal")).findByRole("button", { name: "Start and keep running" }))
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0)
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(/WireCat does not use administrator rights/)
    run.mockResolvedValueOnce({ state: { state: "running", connected: true, startsAtLogin: null }, fault: null })
    await userEvent.click(screen.getAllByRole("button", { name: "Run it for now" })[0] as HTMLElement)
    expect(run).toHaveBeenLastCalledWith("wa", "personal", "start")
  })

  it("hints at the phone when it runs but has not connected", async () => {
    vi.spyOn(platform, "backgroundStatus").mockResolvedValue({
      state: "running",
      connected: false,
      startsAtLogin: true,
    })
    render(<Service tool={wa} />)
    expect((await screen.findAllByText(/Open WhatsApp on your phone/))[0]).toBeInTheDocument()
  })
})
