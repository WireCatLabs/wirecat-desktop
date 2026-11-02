import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { BackgroundLine } from "./Background"

afterEach(() => vi.restoreAllMocks())

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>

describe("a messenger kept up to date in the background", () => {
  it("says when serve is not running, starts it with the tool's own commands, and says it worked", async () => {
    vi.spyOn(platform, "backgroundStatus").mockResolvedValue({ state: "stopped", unit: false })
    const keep = vi.spyOn(platform, "backgroundKeep").mockResolvedValue({ state: "running" })
    render(<BackgroundLine tool={tg} profile="personal" />)
    expect(await screen.findByText("Not kept up to date in the background")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Keep up to date" }))
    expect(keep).toHaveBeenCalledWith("tg", "personal")
    expect(await screen.findByText(/Telegram now keeps this profile up to date/)).toBeInTheDocument()
  })

  it("shows the tool's own reason when it cannot start, and keeps the button", async () => {
    vi.spyOn(platform, "backgroundStatus").mockResolvedValue({ state: "stopped", unit: true })
    vi.spyOn(platform, "backgroundKeep").mockRejectedValue(new Error('profile "personal" is not logged in'))
    render(<BackgroundLine tool={tg} profile="personal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Keep up to date" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Could not start it: profile "personal" is not logged in',
    )
    expect(screen.getByRole("button", { name: "Keep up to date" })).toBeInTheDocument()
  })

  it("says nothing while serve runs or when the tool cannot say", async () => {
    const status = vi.spyOn(platform, "backgroundStatus").mockResolvedValue({ state: "running" })
    const { unmount } = render(<BackgroundLine tool={tg} profile="personal" />)
    await vi.waitFor(() => expect(status).toHaveBeenCalled())
    expect(screen.queryByText("Not kept up to date in the background")).not.toBeInTheDocument()
    unmount()
    status.mockResolvedValue({ state: "unknown" })
    render(<BackgroundLine tool={tg} profile="personal" />)
    await vi.waitFor(() => expect(status).toHaveBeenCalledTimes(2))
    expect(screen.queryByText("Not kept up to date in the background")).not.toBeInTheDocument()
  })
})
