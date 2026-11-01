import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { App } from "./App"

describe("Privacy", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => {
    vi.restoreAllMocks()
    useLanguage.setState({ choice: "system" })
  })

  it("opens from the Help menu by keyboard, says what is sent, and closes", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText("Node.js 24.19.0")

    const help = screen.getByRole("button", { name: "Help" })
    help.focus()
    await user.keyboard("{ArrowDown}{End}{ArrowUp}{Enter}")

    const dialog = await screen.findByRole("dialog", { name: "Privacy" })
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus()
    for (const heading of ["Stays on this computer", "What the app sends, and when", "Never collected"]) {
      expect(within(dialog).getByRole("heading", { name: heading })).toBeInTheDocument()
    }
    expect(within(dialog).getByText("News check")).toBeInTheDocument()
    expect(within(dialog).getByText("Only when you send one")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "Privacy" })).not.toBeInTheDocument()
  })

  it("opens the full policy in the reader's language", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    useLanguage.setState({ choice: "es" })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Ayuda" }))
    await user.click(screen.getByRole("menuitem", { name: "Privacidad" }))
    const dialog = await screen.findByRole("dialog", { name: "Privacidad" })
    await user.click(within(dialog).getByRole("button", { name: /Política de privacidad completa/ }))

    expect(open).toHaveBeenCalledWith("https://wirecat.dev/es/privacy")
  })
})
