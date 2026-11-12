import userEvent from "@testing-library/user-event"
import type { FC } from "react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { addCommunityTools } from "@/domain/catalog"
import { useRegistry } from "@/features/tools"
import { platform } from "@/platform/bridge"
import type { CommunityStatus } from "@/platform/community-schemas"
import { ACME } from "@/platform/mock-community"
import { useNotices } from "@/shared/notices-store"
import { useOnboarding } from "@/shared/onboarding-store"
import { act, render, screen, waitFor, within } from "@/testing/render"

let App: FC

const status = (state: CommunityStatus["state"], days: number, show = true): CommunityStatus => ({
  show,
  available: true,
  listed: 1,
  state,
  expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
})

beforeAll(async () => {
  addCommunityTools([{ source: "community", entry: ACME }])
  ;({ App } = await import("./App"))
})

describe("the community list notice at the top", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useNotices.setState({ notices: [], dismissed: {} })
    useRegistry.setState({ status: null })
  })
  afterEach(() => vi.restoreAllMocks())

  it("counts the days left while the list is running out, and links how it works", async () => {
    vi.spyOn(platform, "communityStatus").mockResolvedValue(status("expiring", 2.5))
    const openUrl = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    const notice = (await screen.findByText(/runs out in/)).closest("li") as HTMLElement
    expect(notice).toHaveTextContent("The list of community tools runs out in 3 days.")
    expect(notice).toHaveTextContent("community tools cannot be installed or updated after")
    await user.click(within(notice).getByRole("link", { name: /How it works/ }))
    expect(openUrl).toHaveBeenCalledWith("https://wirecat.dev/en/docs/desktop#community-tools")
  })

  it("says installs and updates stop once the list expired, on the page and on the tool's row", async () => {
    vi.spyOn(platform, "communityStatus").mockResolvedValue(status("expired", -1))
    render(<App />)

    const notice = (await screen.findByText(/so community tools cannot/)).closest("li") as HTMLElement
    expect(notice).toHaveTextContent(
      "The list of community tools is out of date, so community tools cannot be installed or updated. Installed ones keep working.",
    )
    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const row = within(list)
      .getByRole("button", { name: /^Acme Notes/ })
      .closest("li") as HTMLElement
    expect(await within(row).findByText(/Cannot be installed or updated now/)).toBeInTheDocument()
  })

  it("stays hidden once dismissed, until the list's state changes", async () => {
    const read = vi.spyOn(platform, "communityStatus").mockResolvedValue(status("expiring", 3))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Hide this notice" }))
    await waitFor(() => expect(screen.queryByText(/runs out in/)).not.toBeInTheDocument())
    await act(() => useRegistry.getState().check())
    expect(screen.queryByText(/runs out in/)).not.toBeInTheDocument()

    read.mockResolvedValue(status("expired", -1))
    await act(() => useRegistry.getState().check())
    expect(await screen.findByText(/so community tools cannot/)).toBeInTheDocument()
  })

  it("says nothing while community tools are off", async () => {
    const read = vi.spyOn(platform, "communityStatus").mockResolvedValue(status("expired", -1, false))
    render(<App />)
    await waitFor(() => expect(read).toHaveBeenCalled())
    await act(() => useRegistry.getState().check())
    expect(screen.queryByText(/so community tools cannot|runs out in/)).not.toBeInTheDocument()
  })
})
