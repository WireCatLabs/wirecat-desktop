import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNotifications } from "@/features/notifications/store"
import { useOnboarding } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"
import type { Notification } from "@/platform/notifications-schemas"
import { App } from "./App"
import { useSeen } from "./badges"

const security: Notification = {
  id: "sec-1",
  severity: "security",
  title: { en: "Update Telegram now" },
  body: { en: "First paragraph.\n\nSecond paragraph." },
  link: { url: "https://wirecat.dev/en/security", label: { en: "What changed" } },
  publishedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  expiresAt: null,
}

describe("App notifications", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useNotifications.setState({ items: [], read: [], dismissed: [], checked: false, failed: false, open: false })
    useSeen.setState({ seen: [] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("shows unread news on the bell, opens it as read, and opens its link in the browser", async () => {
    vi.spyOn(platform, "notifications").mockResolvedValue([security])
    const openUrl = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    const bell = await screen.findByRole("button", { name: "Notifications, a security notice is unread" })
    await user.click(bell)
    const panel = screen.getByRole("dialog", { name: "Notifications" })
    expect(within(panel).getByRole("heading", { name: "Update Telegram now" })).toBeInTheDocument()
    expect(within(panel).getByText("Second paragraph.")).toBeInTheDocument()
    expect(within(panel).getByText("New")).toBeInTheDocument()
    expect(within(panel).getByText("2 hours ago")).toBeInTheDocument()

    await user.click(within(panel).getByRole("button", { name: "What changed" }))
    expect(openUrl).toHaveBeenCalledWith("https://wirecat.dev/en/security")

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveFocus()
  })

  it("removes a notification for good when the owner dismisses it", async () => {
    vi.spyOn(platform, "notifications").mockResolvedValue([security])
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: /security notice is unread/ }))
    await user.click(screen.getByRole("button", { name: "Remove “Update Telegram now”" }))

    expect(await screen.findByText("Nothing new")).toBeInTheDocument()
    expect(useNotifications.getState().dismissed).toEqual(["sec-1"])
  })

  it("says it could not check when the server never answered", async () => {
    vi.spyOn(platform, "notifications").mockRejectedValue(new Error("offline"))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText("Node.js 24.19.0")

    await user.click(screen.getByRole("button", { name: "Notifications" }))

    expect(screen.getByText("Couldn’t check for news")).toBeInTheDocument()
  })

  it("marks Agents once tools are installed, and never again after the owner opened it", async () => {
    const user = userEvent.setup()
    render(<App />)
    await vi.waitFor(() => expect(useTools.getState().checked).toBe(true))

    const agents = screen.getByRole("button", { name: "Agents, something new here" })
    await user.click(agents)
    await user.click(screen.getByRole("button", { name: "Tools" }))

    expect(screen.getByRole("button", { name: "Agents" })).toBeInTheDocument()
    expect(useSeen.getState().seen).toEqual(["agents"])
  })
})
