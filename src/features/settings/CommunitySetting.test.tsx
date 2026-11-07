import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { keepLeftOut } from "@/shared/left-out"
import { render, screen } from "@/testing/render"
import { CommunitySetting } from "./CommunitySetting"

afterEach(() => vi.restoreAllMocks())

describe("Enable community tools", () => {
  it("starts off, saves the choice and says it takes effect at the next start", async () => {
    vi.spyOn(platform, "communityStatus").mockResolvedValue({ show: false, available: true, listed: 0 })
    const save = vi.spyOn(platform, "setCommunityShown").mockResolvedValue()
    const restart = vi.spyOn(platform, "restart").mockResolvedValue()
    render(<CommunitySetting />)
    const box = await screen.findByRole("switch", { name: "Enable community tools" })
    await vi.waitFor(() => expect(box).toBeEnabled())
    expect(box).not.toBeChecked()
    await userEvent.hover(screen.getByRole("button", { name: "About community tools" }))
    expect(screen.getByRole("tooltip")).toHaveTextContent(/runs its code on this computer/)

    await userEvent.click(box)
    expect(save).toHaveBeenCalledWith(true)
    expect(box).toBeChecked()
    expect(screen.getByText("Community tools appear the next time WireCat starts.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Restart now" }))
    expect(restart).toHaveBeenCalled()
  })

  it("cannot be turned on in a build without the list's key", async () => {
    vi.spyOn(platform, "communityStatus").mockResolvedValue({ show: false, available: false, listed: 0 })
    render(<CommunitySetting />)
    expect(await screen.findByText(/cannot read the list yet/)).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Enable community tools" })).toBeDisabled()
  })

  it("goes back and says why when the choice cannot be saved", async () => {
    vi.spyOn(platform, "communityStatus").mockResolvedValue({ show: true, available: true, listed: 1 })
    vi.spyOn(platform, "setCommunityShown").mockRejectedValue("Could not save the setting: disk full")
    render(<CommunitySetting />)
    const box = await screen.findByRole("switch", { name: "Enable community tools" })
    await vi.waitFor(() => expect(box).toBeChecked())
    await userEvent.click(box)
    expect(await screen.findByText(/disk full/)).toBeInTheDocument()
    expect(box).toBeChecked()
  })

  it("shows why a listed tool was left out, beside the switch that read it", async () => {
    keepLeftOut([
      { source: "community", text: 'shady: the command word "setup;rm" is not allowed.' },
      { source: "own", text: "mine: the id tg is taken by Telegram." },
    ])
    vi.spyOn(platform, "communityStatus").mockResolvedValue({ show: true, available: true, listed: 0 })
    render(<CommunitySetting />)
    expect(await screen.findByText(/shady: the command word/)).toBeInTheDocument()
    expect(screen.queryByText(/mine: the id tg/)).not.toBeInTheDocument()
    keepLeftOut([])
  })
})
