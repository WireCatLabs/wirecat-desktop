import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DocumentRow } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

type User = ReturnType<typeof userEvent.setup>

const row = (n: number): DocumentRow => ({
  ref: `document:${n}`,
  title: `Synthetic ${n}`,
  fileName: null,
  kind: "md",
  mime: null,
  size: null,
  source: { provider: "notes", account: "1", source: "notes:1", label: "Notes · Synthetic notes" },
  folder: null,
  path: null,
  url: null,
  local: false,
  sourceModifiedAt: null,
  storedAt: null,
  hasText: true,
})

const openDocuments = async (user: User) => {
  render(<App />)
  await user.click(screen.getByRole("button", { name: /^Documents/ }))
  return screen.findByRole("table", { name: "Documents" })
}

describe("Documents", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => vi.restoreAllMocks())

  it("lists every account's documents, and a folder in the Account chip's tree narrows the list", async () => {
    const list = vi.spyOn(platform, "documentsList")
    const user = userEvent.setup()
    const table = await openDocuments(user)
    expect(await within(table).findByRole("button", { name: /Q4 plan/ })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^Account/ }))
    const tree = screen.getByRole("tree", { name: "Folders" })
    await user.click(within(tree).getByText("ana@example.org"))
    await user.click(await within(tree).findByText("Projects"))
    await user.click(await within(tree).findByText("Acme"))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith('source:"google-drive:ana@example.org" folder:"Projects/Acme"', 1, 25),
    )
    await waitFor(() => expect(within(table).queryByRole("button", { name: /Weekly review/ })).toBeNull())
    expect(screen.getByRole("searchbox", { name: "Search documents" })).toHaveValue(
      'source:"google-drive:ana@example.org" folder:"Projects/Acme"',
    )
  })

  it("drops the chosen folder when the tree moves to another account", async () => {
    const list = vi.spyOn(platform, "documentsList")
    const user = userEvent.setup()
    await openDocuments(user)
    await user.click(screen.getByRole("button", { name: /^Account/ }))
    const tree = screen.getByRole("tree", { name: "Folders" })
    await user.click(within(tree).getByText("ana@example.org"))
    await user.click(await within(tree).findByText("Projects"))
    await user.click(within(tree).getByText("Synthetic notes"))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('source:"notes:1"', 1, 25))
  })

  it("asks memo for the next page instead of cutting one long list", async () => {
    vi.spyOn(platform, "documentsList").mockImplementation(async (_query, page, limit) => ({
      documents: Array.from({ length: limit }, (_, i) => row((page - 1) * limit + i + 1)),
      total: 1_240,
      totalMore: false,
      more: page * limit < 1_240,
    }))
    const user = userEvent.setup()
    await openDocuments(user)
    const pager = await screen.findByRole("navigation", { name: "Pages" })
    await user.click(within(pager).getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(platform.documentsList).toHaveBeenLastCalledWith("", 2, 25))
  })

  it("narrows by kind with its chip, and says when nothing matches", async () => {
    const user = userEvent.setup()
    await openDocuments(user)
    vi.spyOn(platform, "documentsList").mockResolvedValue({ documents: [], total: 0, totalMore: false, more: false })
    await user.click(screen.getByRole("button", { name: /^Kind/ }))
    await user.click(await screen.findByRole("option", { name: /PDF/ }))
    await waitFor(() => expect(platform.documentsList).toHaveBeenLastCalledWith("kind:pdf", 1, 25))
    expect(await screen.findByText("No document matches these filters.")).toBeInTheDocument()
  })

  it("opens a document, reads more of its text, and takes a person to Contacts", async () => {
    const show = vi.spyOn(platform, "documentsShow")
    const user = userEvent.setup()
    const table = await openDocuments(user)
    await user.click(await within(table).findByRole("button", { name: /Q4 plan/ }))
    const dialog = await screen.findByRole("dialog", { name: "Q4 plan" })
    expect(await within(dialog).findByText(/1\. The plan for the fourth quarter/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /Open in Google Drive/ })).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Show more" }))
    await waitFor(() => expect(show).toHaveBeenLastCalledWith("document:40", 2_000))
    expect(await within(dialog).findByText(/20\. The plan/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Open Lena Ortiz on Contacts" }))
    expect(await screen.findByRole("dialog", { name: "Lena Ortiz" })).toBeInTheDocument()
  })

  it("shows a local document's file in its folder through Rust, by its ref", async () => {
    const reveal = vi.spyOn(platform, "documentsReveal")
    const user = userEvent.setup()
    const table = await openDocuments(user)
    await user.click(await within(table).findByRole("button", { name: /Weekly review/ }))
    const dialog = await screen.findByRole("dialog", { name: "Weekly review" })
    await user.click(await within(dialog).findByRole("button", { name: "Show in folder" }))
    expect(reveal).toHaveBeenCalledWith(expect.stringMatching(/^document:\d+$/))
  })

  it("offers memo's update when memo has no documents yet", async () => {
    vi.spyOn(platform, "documentsRead").mockResolvedValue({ kind: "old", version: "0.132.0", need: "0.133.0" })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /^Documents/ }))
    expect(await screen.findByText(/needs Memo 0.133.0 or newer/)).toBeInTheDocument()
    expect(screen.queryByRole("table", { name: "Documents" })).toBeNull()

    useTools.setState({ install: vi.fn(async () => {}) })
    const scroll = vi.fn()
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: scroll, configurable: true })
    await user.click(screen.getByRole("button", { name: "Update Memo" }))
    // The link lands on Memo's row, not the top of Tools: brought into view, marked and focused.
    const memo = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-tool="memo"]')
      expect(el).toHaveAttribute("data-target-flash")
      return el as HTMLElement
    })
    expect(scroll.mock.contexts).toContain(memo)
    expect(within(memo).getAllByRole("button", { expanded: true })[0]).toHaveFocus()
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  })
})
