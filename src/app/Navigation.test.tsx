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
      "Meetings",
      "Documents",
      "Memory",
      "Guides",
      "Analytics",
      "Search",
    ])
    expect(names("Data and settings")).toEqual(["Logs", "Settings"])
  })

  it("opens the old Agents, Storage and Digests pages as tabs", async () => {
    render(<App />)
    expect(
      within(screen.getByRole("tablist", { name: "Tools" }))
        .getAllByRole("tab")
        .map((t) => t.textContent),
    ).toEqual(["Tools", "Agents", "Digests"])

    act(() => useNav.getState().go("agents"))
    expect(sidebarPage()).toHaveAccessibleName(/^Tools/)
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Agents/)
    expect(screen.queryByRole("heading", { name: "Digests" })).not.toBeInTheDocument()

    act(() => useNav.getState().go("storage"))
    expect(sidebarPage()).toHaveAccessibleName(/^Analytics/)
    expect(selectedTab("Analytics")).toHaveAccessibleName(/^Storage/)

    // `?section=digests`, a saved page and a digest's notice all name the old archive's id: it is the tab now.
    act(() => useNav.getState().go("digests"))
    expect(sidebarPage()).toHaveAccessibleName(/^Tools/)
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Digests/)
    expect(await screen.findByRole("table", { name: "Digests" })).toBeInTheDocument()
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

  it("opens the digest that arrived from its notice in the bell on the Digests tab, and marks it", async () => {
    const user = userEvent.setup()
    render(<App />)
    act(() =>
      useNotifications.getState().addDigest({ date: today(), stamp: "s1", title: "Digest for today", body: "Calm" }),
    )
    await user.click(screen.getByRole("button", { name: /^Notifications, \d+ unread/ }))
    await user.click(await screen.findByRole("button", { name: "Open the digest" }))
    await waitFor(() => expect(screen.getByRole("region", { name: "Settings" })).toBeInTheDocument())
    expect(useNav.getState().active).toBe("digests")
    expect(selectedTab("Tools")).toHaveAccessibleName(/^Digests/)
    await waitFor(() => expect(document.querySelector("[data-digest-view]")).toHaveAttribute("data-target-flash"))
    expect(document.querySelector("[data-digest-view]")).toHaveFocus()
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
    await user.click(await screen.findByRole("button", { name: "Open Morning digest" }))
    await screen.findByRole("region", { name: "Settings" })
    expect(screen.getAllByRole("button", { name: "All digests" })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "All digests" }))
    expect(await screen.findByRole("table", { name: "Digests" })).toBeInTheDocument()
  })
})
