import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useNotifications } from "@/features/notifications"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { safeStorage } from "@/shared/safe-storage"
import { act, fireEvent, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const sidebarPage = () => screen.getByRole("button", { current: "page" })
const pageTabs = (name: string) => screen.getByRole("tablist", { name })
const selectedTab = (page: string) => within(pageTabs(page)).getByRole("tab", { selected: true })

describe("Navigation", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("lists the pages in the owner's order, with Agents, Storage and Digests no longer in the sidebar", () => {
    render(<App />)
    const names = (nav: string) =>
      within(screen.getByRole("navigation", { name: nav }))
        .getAllByRole("button")
        .map((b) => b.textContent?.replace("β", "").trim())
    expect(names("Sections")).toEqual([
      "Tools",
      "Tasks",
      "Clients",
      "Contacts",
      "Memory",
      "Guides",
      "Analytics",
      "Search",
    ])
    expect(names("Data and settings")).toEqual(["Logs", "Settings"])
  })

  it("opens the old Agents and Storage pages as tabs, and the old Digests page as the archive", async () => {
    const user = userEvent.setup()
    render(<App />)

    act(() => useNav.getState().go("agents"))
    expect(sidebarPage()).toHaveAccessibleName(/^Tools/)
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Agents/)
    expect(await screen.findByRole("heading", { name: "Schedules and digests" })).toBeInTheDocument()

    act(() => useNav.getState().go("storage"))
    expect(sidebarPage()).toHaveAccessibleName(/^Analytics/)
    expect(selectedTab("Analytics")).toHaveAccessibleName(/^Storage/)

    act(() => useNav.getState().go("digests"))
    expect(await screen.findByRole("heading", { level: 1, name: "Digests" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { current: "page" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Back to Agents" }))
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Agents/)
  })

  it("keeps the tab as the page's address: saved for the next start, and stepped through with back and forward", async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Tools/)

    await user.click(screen.getByRole("tab", { name: /^Agents/ }))
    expect(useNav.getState().active).toBe("agents")
    expect(safeStorage.getItem("wirecat.page")).toBe("agents")

    await user.click(screen.getByRole("button", { name: /^Analytics/ }))
    await user.click(screen.getByRole("tab", { name: /^Storage/ }))
    expect(safeStorage.getItem("wirecat.page")).toBe("storage")

    fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true })
    expect(selectedTab("Analytics")).toHaveAccessibleName(/^Data/)
    fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true })
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Agents/)
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true })
    expect(selectedTab("Analytics")).toHaveAccessibleName(/^Data/)
  })

  it("moves between tabs with the arrow keys and keeps the focus on the tab it moved to", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("tab", { name: /^Tools/ }))
    await user.keyboard("{ArrowRight}")
    const agents = screen.getByRole("tab", { name: /^Agents/ })
    expect(agents).toHaveAttribute("aria-selected", "true")
    expect(agents).toHaveFocus()
    expect(screen.getByRole("tabpanel", { name: /^Agents/ })).toBeInTheDocument()
    await user.keyboard("{Home}")
    expect(screen.getByRole("tab", { name: /^Tools/ })).toHaveFocus()
    expect(useNav.getState().active).toBe("tools")
  })

  it("opens the archive from All digests, and a digest that arrived from its notice in the bell", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("tab", { name: /^Agents/ }))
    await user.click(await screen.findByRole("button", { name: "All digests" }))
    expect(useNav.getState().active).toBe("digests")
    expect(await screen.findByRole("heading", { level: 1, name: "Digests" })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Open Morning digest" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create digest" })).not.toBeInTheDocument()
    expect(screen.queryByText("Other schedules")).not.toBeInTheDocument()

    act(() =>
      useNotifications.getState().addDigest({ date: today(), stamp: "s1", title: "Digest for today", body: "Calm" }),
    )
    await user.click(screen.getByRole("button", { name: /^Notifications, \d+ unread/ }))
    await user.click(await screen.findByRole("button", { name: "Open the digest" }))
    await waitFor(() => expect(screen.getByRole("region", { name: "Settings" })).toBeInTheDocument())
    expect(useNav.getState().active).toBe("digests")
  })

  it("keeps the tabs when one tab breaks, so the other still opens", async () => {
    window.history.replaceState(null, "", "/?crash=agents")
    try {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole("tab", { name: /^Agents/ }))
      expect(await screen.findByRole("heading", { name: "Something broke on this page" })).toBeInTheDocument()
      await user.click(screen.getByRole("tab", { name: /^Tools/ }))
      expect(screen.queryByRole("heading", { name: "Something broke on this page" })).not.toBeInTheDocument()
    } finally {
      window.history.replaceState(null, "", "/")
    }
  })

  it("gives an open digest one way back, to the list", async () => {
    const user = userEvent.setup()
    render(<App />)
    act(() => useNav.getState().go("digests"))
    expect(await screen.findByRole("button", { name: "Back to Agents" })).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: "Open Morning digest" }))
    await screen.findByRole("region", { name: "Settings" })
    expect(screen.queryByRole("button", { name: "Back to Agents" })).not.toBeInTheDocument()
  })
})
