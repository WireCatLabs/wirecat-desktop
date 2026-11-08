import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeepLinkTarget } from "@/domain/links"
import { useMemory } from "@/features/memory"
import { useTasks } from "@/features/tasks"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { act, render, screen, waitFor } from "@/testing/render"
import { App } from "./App"

let deliver: (target: DeepLinkTarget | null) => void = () => {}

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  vi.spyOn(platform, "listenLinks").mockImplementation(async (onLink) => {
    deliver = onLink
  })
})

const link = (target: DeepLinkTarget | null) => act(() => deliver(target))

describe("wirecat:// links", () => {
  it("open a task over the page the owner was on, and Back returns there", async () => {
    render(<App />)
    useNav.getState().go("logs")
    link({ type: "task", id: "HRB-14" })
    expect(await screen.findByRole("dialog", {}, { timeout: 4000 })).toHaveTextContent("Task HRB-14")
    expect(useNav.getState().active).toBe("tasks")
    act(() => useNav.getState().back())
    expect(useNav.getState().active).toBe("logs")
  }, 15000)

  it("open the task list on the filter the link names", async () => {
    render(<App />)
    link({ type: "tasks", filter: "overdue" })
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"))
    expect(useTasks.getState().query).toBe("when:overdue")
    link({ type: "tasks", filter: "new", since: "2026-11-07T08:00:00+03:00" })
    expect(useTasks.getState().query).toBe('created:>="2026-11-07T08:00:00+03:00"')
    link({ type: "tasks", filter: "undated" })
    expect(useTasks.getState().query).toBe("when:none")
  })

  it("open a proposal's row on the Memory page and press nothing", async () => {
    const confirm = vi.spyOn(platform, "memoryConfirm")
    render(<App />)
    link({ type: "proposal", id: "fact:21" })
    await waitFor(() => expect(useNav.getState().active).toBe("memory"), { timeout: 4000 })
    expect(useMemory.getState().open).toBe("fact:21")
    expect(confirm).not.toHaveBeenCalled()
  }, 15000)

  it("open a tool's sync for a sync link, by the name the store uses", async () => {
    render(<App />)
    link({ type: "sync", tool: "telegram", account: "1001" })
    await waitFor(() => expect(useTools.getState().expanded).toBe("tg"))
    expect(useNav.getState().active).toBe("tools")
  })

  it("say a proposal kind with no page cannot open yet, with its reference to copy and the way back", async () => {
    const user = userEvent.setup()
    render(<App />)
    useNav.getState().go("logs")
    link({ type: "proposal", id: "deal:7" })
    expect(await screen.findByRole("heading", { name: "This can't open in WireCat yet" })).toBeInTheDocument()
    expect(screen.getByText("proposal:deal%3A7")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(useNav.getState().active).toBe("logs")
  })

  it("say calmly that a refused link was not opened", async () => {
    render(<App />)
    link(null)
    expect(await screen.findByRole("heading", { name: "WireCat can't open this link" })).toBeInTheDocument()
    expect(screen.getByText(/Nothing was done/)).toBeInTheDocument()
  })

  it("say a task that is not on this computer is missing", async () => {
    render(<App />)
    link({ type: "task", id: "NOPE-1" })
    expect(
      await screen.findByRole("heading", { name: "This item is not on this computer" }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it("wait for the first-run setup to close", async () => {
    useOnboarding.setState({ status: "new", open: true })
    render(<App />)
    const before = useNav.getState().active
    link({ type: "tasks", filter: "today" })
    expect(useNav.getState().active).toBe(before)
    act(() => useOnboarding.setState({ open: false }))
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"))
  })

  it("are never the page the next launch reopens", () => {
    useNav.getState().go("logs")
    useNav.getState().go("open")
    expect(localStorage.getItem("wirecat.page")).toBe("logs")
  })
})
