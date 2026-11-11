import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform, withOpenFailure } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, screen, within } from "@/testing/render"
import { App } from "./App"

describe("a link the system cannot open", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => vi.restoreAllMocks())

  it("shows the address to copy and the system's reason instead of doing nothing", async () => {
    const refused = withOpenFailure({ ...platform, openUrl: () => Promise.reject("no handler for https") })
    vi.spyOn(platform, "openUrl").mockImplementation(refused.openUrl)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Help" }))
    await user.click(screen.getByRole("menuitem", { name: "About WireCat" }))
    await user.click(
      within(await screen.findByRole("dialog", { name: "About WireCat" })).getByRole("link", { name: "Website" }),
    )

    const failed = await screen.findByRole("dialog", { name: "The link did not open" })
    expect(within(failed).getByText("https://wirecat.dev")).toBeInTheDocument()
    expect(within(failed).getByText("The system said: no handler for https")).toBeInTheDocument()
    await user.click(within(failed).getByRole("button", { name: "Copy the address" }))
    expect(await navigator.clipboard.readText()).toBe("https://wirecat.dev")
  })
})
