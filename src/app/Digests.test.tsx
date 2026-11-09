import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeepLinkTarget } from "@/domain/links"
import { checkForNew, useDigests } from "@/features/digests"
import { useTasks } from "@/features/tasks"
import { platform } from "@/platform/bridge"
import type { DigestDay } from "@/platform/digest-schemas"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { act, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

let deliver: (target: DeepLinkTarget | null) => void = () => {}

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  vi.spyOn(platform, "listenLinks").mockImplementation(async (onLink) => {
    deliver = onLink
  })
})

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

describe("Digests", () => {
  it("lists one day per digest, newest first, and lays the newest out with its sections", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Digests/ }))
    const days = await screen.findByRole("navigation", { name: "Days" })
    expect(within(days).getAllByRole("button")).toHaveLength(4)
    expect(within(days).getAllByRole("button")[0]).toHaveAttribute("aria-current", "page")
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    expect(today).toHaveTextContent("Anna Kotova · warehouse lease — Answer whether signing on Friday works")
    expect(today).toHaveTextContent("Igor Lapin asks: can the tile delivery move to the 20th?")
    expect(
      screen.getByText(/Viewed over 24 hr: Telegram, MAX, mail \(4 inboxes\) · 31 chats, 12 emails, 17 tasks/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Telegram \(@ownerdemo\): sync fails since/)).toBeInTheDocument()
  }, 15000)

  it("opens an item's task, and a task group's list, inside the app", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Digests/ }))
    await user.click(
      await screen.findByRole("button", { name: "Open: Reconciliation for North Wind" }, { timeout: 4000 }),
    )
    expect(await screen.findByRole("dialog", {}, { timeout: 4000 })).toHaveTextContent("Task HRB-14")
    expect(useNav.getState().active).toBe("tasks")

    act(() => useNav.getState().back())
    await user.click(await screen.findByRole("button", { name: "All overdue (5)" }, { timeout: 4000 }))
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"))
    expect(useTasks.getState().query).toBe("when:overdue")
  }, 20000)

  it("shows an older run's text as it was", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Digests/ }))
    const days = await screen.findByRole("navigation", { name: "Days" })
    await user.click(within(days).getAllByRole("button")[3] as HTMLElement)
    expect(await screen.findByText(/Pay November rent to Vector LLC/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText(/here is its text as it was/)).toBeInTheDocument()
  }, 15000)

  it("opens a day from a digest link, and says when that day has no digest", async () => {
    render(<App />)
    act(() => deliver({ type: "digest", date: today() }))
    await waitFor(() => expect(useNav.getState().active).toBe("digests"), { timeout: 4000 })
    act(() => deliver({ type: "digest", date: "2001-01-01" }))
    expect(
      await screen.findByRole("heading", { name: "This item is not on this computer" }, { timeout: 4000 }),
    ).toBeInTheDocument()
  }, 15000)
})

describe("the new digest notification", () => {
  const day = (stamp: string): DigestDay => ({
    date: stamp.slice(0, 10),
    stamp,
    summary: "Two replies wait.",
    report: true,
    backfill: false,
  })

  it("stays quiet on the first look, then announces a newer run with its title and summary", async () => {
    const notify = vi.spyOn(platform, "digestNotify").mockResolvedValue()
    const list = vi.spyOn(platform, "digestList").mockResolvedValue([day("2026-11-07T07-30-00Z")])
    await checkForNew()
    expect(notify).not.toHaveBeenCalled()

    await checkForNew()
    expect(notify).not.toHaveBeenCalled()

    list.mockResolvedValue([day("2026-11-08T07-30-00Z"), day("2026-11-07T07-30-00Z")])
    await checkForNew()
    expect(notify).toHaveBeenCalledWith("2026-11-08", "☀️ Digest for Sunday, November 8", "Two replies wait.", "Open")
    expect(useDigests.getState().days?.[0]?.date).toBe("2026-11-08")

    await checkForNew()
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
