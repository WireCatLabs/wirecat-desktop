import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useNav } from "../nav"
import { useTools } from "../tools/store"
import { SearchPage } from "./SearchPage"
import { useSearch } from "./store"

beforeEach(() => useSearch.setState(useSearch.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

async function choose(user: ReturnType<typeof userEvent.setup>, box: string, option: string) {
  const select = await screen.findByRole("combobox", { name: box })
  await waitFor(() => expect(select).not.toHaveAttribute("aria-disabled", "true"))
  await waitFor(() => expect(select).toBeEnabled())
  await user.click(select)
  await user.click(await screen.findByRole("option", { name: option }))
}

describe("Search", () => {
  it("searches one tool for the profile the owner picks, and pages through the hits", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })

    await choose(user, "Tool", "Telegram")
    const profile = await screen.findByRole("combobox", { name: "Profile" })
    await waitFor(() => expect(profile).toHaveTextContent("Choose a profile"))
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "invoice{Enter}")
    expect(search).not.toHaveBeenCalled()
    expect(await screen.findByText("Choose a profile to search in.")).toBeInTheDocument()
    expect(profile).toHaveFocus()
    expect(profile).toHaveAttribute("aria-invalid", "true")

    await choose(user, "Profile", "personal")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByText("Showing 1–50 of 128 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith("tg", "personal", "invoice", 50, 1)
    expect(screen.getByText(/searched 12,480 messages/)).toBeInTheDocument()
    expect(screen.getAllByText("Photo").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Voice message").length).toBeGreaterThan(0)
    expect(screen.getAllByText("invoice.pdf").length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole("button", { name: "Show the whole result: Harbour flat" })[0] as HTMLElement)
    expect(await screen.findByText("msg:telegram/1/-1000/4000")).toBeInTheDocument()
    expect(screen.getByText("Reference")).toBeInTheDocument()
    expect(screen.queryByText("untrusted")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show raw data" }))
    const raw = await screen.findByRole("group", { name: "Everything the tool returned for this result" })
    expect(raw).toHaveTextContent("chat_title")
    expect(raw).not.toHaveTextContent("untrusted")

    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(await screen.findByText("Showing 51–100 of 128 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith("tg", "personal", "invoice", 50, 2)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled()
  }, 15000)

  it("keeps Search active and says what is missing, then runs a plain word search", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })
    const button = screen.getByRole("button", { name: "Search" })
    expect(button).toBeEnabled()

    await user.click(button)
    expect(await screen.findByText("Choose a tool to search in.")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Tool" })).toHaveFocus()

    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.click(button)
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    expect(await screen.findByText(/Type what to look for/)).toBeInTheDocument()
    expect(bar).toHaveFocus()
    expect(search).not.toHaveBeenCalled()

    await user.type(bar, "invoice{Enter}")
    await waitFor(() => expect(search).toHaveBeenCalledWith("tg", "personal", "invoice", 50, 1))
    expect(screen.queryByText(/Type what to look for/)).not.toBeInTheDocument()
  }, 15000)

  it("lists the keys to search by in an empty box, and has: values only after has:", async () => {
    const user = userEvent.setup()
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.click(bar)
    const list = await screen.findByRole("listbox")
    const options = within(list)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(options[0]).toContain("from:")
    expect(options.some((o) => o?.startsWith("chat:"))).toBe(true)
    expect(options.some((o) => o?.startsWith("has:photo"))).toBe(true)
    expect(within(list).getByText("Try")).toBeInTheDocument()

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}")
    expect(bar).toHaveValue("has:")
    expect(within(screen.getByRole("listbox")).getByRole("option", { name: /^voice/ })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("filters by a value from a result and searches again, or groups the page by it", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "invoice{Enter}")
    await user.click(
      (
        await screen.findAllByRole("button", { name: "Show the whole result: Harbour flat" }, { timeout: 3000 })
      )[0] as HTMLElement,
    )

    await user.click(screen.getByRole("button", { name: "Group by chat" }))
    expect(screen.getByText("The 50 results on this page by chat")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show results" }))

    await user.click(
      (await screen.findAllByRole("button", { name: "Show the whole result: Harbour flat" }))[0] as HTMLElement,
    )
    await user.click(screen.getByRole("button", { name: "Filter by chat:Harbour flat" }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("tg", "personal", 'invoice chat:"Harbour flat"', 50, 1))
  }, 15000)

  it("shows the messages around a result, read by the tool for the hit's ref", async () => {
    const user = userEvent.setup()
    const context = vi.spyOn(platform, "searchContext")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "invoice{Enter}")
    const show = await screen.findAllByRole(
      "button",
      { name: "Show the whole result: Harbour flat" },
      { timeout: 3000 },
    )
    await user.click(show[0] as HTMLElement)
    await user.click(screen.getByRole("button", { name: "Show messages around it" }))
    const around = await screen.findByRole("list", { name: "Messages around this result" }, { timeout: 3000 })
    expect(context).toHaveBeenCalledWith("tg", "personal", "msg:telegram/1/-1000/4000")
    expect(
      within(around).getByText("Sent the invoice for October, can you check the VAT line?").closest("li"),
    ).toHaveAttribute("aria-current", "true")
    expect(within(around).getByText("invoice-2026-10.pdf")).toBeInTheDocument()
  }, 15000)

  it("writes a query from plain words into the box, and never searches by itself", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await user.click(screen.getByRole("button", { name: "Write the query" }))
    expect(screen.getByText("Describe what you want to find first.")).toBeInTheDocument()
    const request = screen.getByLabelText("Describe what you're looking for")
    expect(request).toHaveFocus()

    await user.type(request, "photos from Ana Ruiz last week{Enter}")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await waitFor(() => expect(bar).toHaveValue('from:"Ana Ruiz" has:photo date>=7d'), { timeout: 4000 })
    expect(bar).toHaveFocus()
    expect(screen.getByText(/Claude Code, with your Claude plan, wrote the query below/)).toBeInTheDocument()
    expect(search).not.toHaveBeenCalled()
  }, 15000)

  it("says which agent could not write the query, and how to fix it", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchDraft").mockResolvedValue({
      kind: "failed",
      by: "codex",
      reason: "signed-out",
      message: "",
    })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "как купить велосипед у Милы{Enter}")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Codex, with your ChatGPT plan, could not write the query: it is not signed in. Run codex login once in a terminal.",
    )
    expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("")
  }, 15000)

  it("points to the Agents page when no agent can write the query", async () => {
    const user = userEvent.setup()
    const draft = vi.spyOn(platform, "searchDraft").mockResolvedValue({ kind: "none" })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "photos from Ana")
    await user.click(screen.getByRole("button", { name: "Write the query" }))
    expect(await screen.findByText(/WireCat needs one of these agents/)).toBeInTheDocument()
    expect(draft).toHaveBeenCalledWith("tg", "photos from Ana")
    await user.click(screen.getByRole("button", { name: "Open Agents" }))
    expect(useNav.getState().active).toBe("agents")
  }, 15000)

  it("shows the tool's query error at its place until the query changes", async () => {
    const user = userEvent.setup()
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.type(bar, "invoice bogus:x{Enter}")

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      'There is no such field. The tool says: no field "bogus"',
    )
    expect(bar).toHaveAttribute("aria-invalid", "true")
    await user.type(bar, "y")
    expect(bar).not.toHaveAttribute("aria-invalid")
  }, 15000)

  it("asks a tool without profiles for no profile", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Memo")
    expect(screen.queryByRole("combobox", { name: "Profile" })).not.toBeInTheDocument()
    await user.type(screen.getByRole("combobox", { name: "Search notes" }), "plan{Enter}")
    expect(await screen.findByText("Showing 1–50 of 128 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith("memo", null, "plan", 50, 1)
  }, 15000)

  it("says which update a tool too old to search needs", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchStore").mockResolvedValue({ kind: "old", message: "unknown option '--offline'" })
    render(<SearchPage />)
    await choose(user, "Tool", "MAX")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "x{Enter}")
    expect(await screen.findByText(/MAX 0\.74\.0 can't search its local data yet/)).toBeInTheDocument()

    await choose(user, "Tool", "Telegram")
    await user.click(screen.getByRole("combobox", { name: "Tool" }))
    expect(await screen.findByRole("option", { name: "MAX — update to search" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  }, 15000)

  it("offers to report a search the tool itself failed", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchStore").mockResolvedValue({
      kind: "failed",
      candidates: [],
      message: "the command failed; this is a bug",
    })
    render(<SearchPage />)
    await choose(user, "Tool", "MAX")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "hello{Enter}")
    expect(await screen.findByText("the command failed; this is a bug")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Report this" })).toBeVisible()
  }, 15000)

  it("shows no results, not an error, for an empty answer that did not cover every chat", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchStore").mockResolvedValue({
      kind: "hits",
      hits: [],
      hasMore: false,
      paged: true,
      notes: ["searched 207,424 messages in 1,380 chats — 27 never fetched"],
      total: null,
    })
    render(<SearchPage />)
    await choose(user, "Tool", "MAX")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "zzq{Enter}")
    expect(await screen.findByText(/Nothing matches this search/)).toBeInTheDocument()
    expect(screen.getByText(/27 never fetched/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Report this" })).not.toBeInTheDocument()
  }, 15000)

  it("offers ready queries, then the tool's own values after a field", async () => {
    const user = userEvent.setup()
    const values = vi.spyOn(platform, "searchValues")
    render(<SearchPage />)
    await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await waitFor(() => expect(values).toHaveBeenCalledWith("tg", "personal", "chats"))
    await waitFor(() => expect(Object.values(useSearch.getState().lists).some((l) => l.length > 0)).toBe(true))
    const bar = screen.getByRole("combobox", { name: "Search messages" })

    await user.click(bar)
    await user.click(await screen.findByRole("option", { name: /has:photo date>=7d/ }))
    expect(bar).toHaveValue("has:photo date>=7d ")

    await user.type(bar, "chat:des")
    await user.click(await screen.findByRole("option", { name: /Design crit/ }))
    expect(bar).toHaveValue('has:photo date>=7d chat:"-1001001" ')
    const chip = screen.getByRole("button", { name: "Edit chat: Design crit" })
    expect(chip).toHaveAttribute("title", 'chat: Design crit\nchat:"-1001001"')
    expect(bar).toHaveAccessibleDescription(/Names in this search: chat: Design crit/)

    await user.click(chip)
    const input = bar as HTMLInputElement
    expect([input.selectionStart, input.selectionEnd]).toEqual([19, 34])
    await user.keyboard("{End}{ArrowLeft}{Backspace}")
    expect(bar).toHaveValue("has:photo date>=7d")
    expect(screen.queryByRole("button", { name: "Edit chat: Design crit" })).not.toBeInTheDocument()
  }, 15000)

  it("turns a chat name that fits two chats into a choice that names one by id", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.type(bar, "date>=3d chat:kyrillic{Enter}")

    expect(await screen.findByText("This name fits several chats. Pick the one you meant below.")).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: /^@kyrillic/ }))
    expect(bar).toHaveValue('date>=3d chat:"-1001762030832"')
    expect(screen.getByRole("button", { name: "Edit chat: @kyrillic" })).toBeInTheDocument()
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith("tg", "personal", 'date>=3d chat:"-1001762030832"', 50, 1),
    )
  }, 15000)
})

describe("search keys", () => {
  it("each key a tool searches by has a meaning in every language", async () => {
    const { tools } = await import("@/domain/catalog")
    const { searchMessages } = await import("./messages")
    for (const tool of tools) {
      const what = tool.search?.what === "documents" ? "notes" : tool.search?.what
      for (const f of tool.search?.fields ?? [])
        for (const [lang, m] of Object.entries(searchMessages))
          expect(m.fields[`${what}:${f.name}`], `${lang} ${tool.id} ${f.name}`).toBeTruthy()
    }
  })
})
