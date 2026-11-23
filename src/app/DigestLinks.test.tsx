import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { useDigestBook, useDigests } from "@/features/digests"
import { useTasks } from "@/features/tasks"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { loadPages } from "@/testing/pages"
import { act, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

beforeAll(loadPages)

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  useDigestBook.setState({ book: null, busy: {}, failed: null, open: null })
  useDigests.setState({ name: undefined, days: null, error: null, reading: false, shown: {} })
  vi.spyOn(platform, "listenLinks").mockResolvedValue()
})

async function openDigest() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: /^Digests/ }))
  await screen.findByRole("region", { name: "Today" })
  return user
}

const follow = async (name: string) => {
  const user = await openDigest()
  await user.click(screen.getAllByRole("button", { name })[0] as HTMLElement)
  return user
}

describe("a link in a digest", () => {
  it("opens a mail message in its thread, and a chat, read only", async () => {
    await follow("Open: warehouse lease")
    await waitFor(() => expect(useNav.getState().active).toBe("conversation"))

    act(() => useNav.getState().go("digests"))
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Open: tile delivery" }))
    await waitFor(() => expect(useNav.getState().active).toBe("conversation"))
  })

  it("opens a person's card on Contacts", async () => {
    await follow("Open: Kai Moreno")
    expect(await screen.findByRole("dialog", { name: /Kai Moreno/ })).toBeInTheDocument()
    expect(useNav.getState().active).toBe("people")
  })

  it("opens a calendar event in its meeting card", async () => {
    await follow("Open: Board review")
    expect(await screen.findByRole("dialog", { name: /Board review/ })).toBeInTheDocument()
    expect(useNav.getState().active).toBe("meetings")
  })

  it("opens a CRM deal in its card on Clients", async () => {
    await follow("Open: Northstar Labs · Site for Northstar")
    expect(await screen.findByRole("dialog", { name: /Site for Northstar/ })).toBeInTheDocument()
    expect(useNav.getState().active).toBe("clients")
  })

  it("opens a document in its details, and leaves a ref nothing opens as plain text", async () => {
    const user = await openDigest()
    const projects = screen.getByRole("region", { name: "Projects in motion" })
    await user.click(within(projects).getByRole("button", { name: "Details: Q4 plan" }))
    const list = (await within(projects).findByText("Opens in WireCat")).closest("dl") as HTMLElement
    expect(
      within(list)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["the document"])

    await user.click(within(projects).getByRole("button", { name: "Open: Q4 plan" }))
    expect(await screen.findByRole("dialog", { name: /Q4 plan/ })).toBeInTheDocument()
    expect(useNav.getState().active).toBe("documents")
  })

  it("opens a proposal on Memory, and a task in its dialog", async () => {
    await follow("Open: Findings from mail")
    await waitFor(() => expect(useNav.getState().active).toBe("memory"))

    act(() => useNav.getState().go("digests"))
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Open: Reconciliation for North Wind" }))
    expect(await screen.findByRole("dialog")).toHaveTextContent("Task HRB-14")
  })

  it("opens a known project's tasks, and an unknown one on the calm not-yet page", async () => {
    await follow("Open: project HRB")
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"))
    expect(useTasks.getState().query).toBe("project:HRB")

    act(() => useNav.getState().go("digests"))
    const user = userEvent.setup()
    await user.click(
      (await screen.findAllByRole("button", { name: "Open: project khimki-warehouse" }))[0] as HTMLElement,
    )
    expect(await screen.findByRole("heading", { name: "This can't open in WireCat yet" })).toBeInTheDocument()
  })

  it("opens a failing account's sync from the sync line", async () => {
    await follow("Fix: Telegram (@ownerdemo)")
    await waitFor(() => expect(useNav.getState().active).toBe("tools"))
  })

  it("gives an item with no ref nothing to click", async () => {
    await openDigest()
    const money = screen.getByRole("region", { name: "Money" })
    expect(within(money).getByRole("button", { name: "Details: Vector LLC · November rent" })).toBeInTheDocument()
    expect(within(money).queryByRole("button", { name: "Open: Vector LLC · November rent" })).not.toBeInTheDocument()
  })
})
