import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { HarderOutcome, HarderStatus } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { SearchPage } from "./SearchPage"
import { useSearch } from "./store"

afterEach(() => vi.restoreAllMocks())

const allowed: HarderStatus = {
  on: true,
  provider: "anthropic",
  model: "claude-haiku-5-5",
  endpointHost: "api.anthropic.com",
  baseUrl: null,
  proposedFromEnrichment: false,
  consentedAt: "2026-11-09T09:12:00.000Z",
  candidates: 30,
  charsPerHit: 400,
  usdPerMillionInput: 0.1,
  usdPerMillionOutput: 0.5,
  key: { present: false, source: null, envVar: "ANTHROPIC_API_KEY" },
}

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
    expect(screen.getByText("Searched 12 480 messages in 64 chats")).toBeInTheDocument()
    expect(screen.queryByText(/never fetched/)).not.toBeInTheDocument()
    expect(screen.getAllByText("Photo").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Voice message").length).toBeGreaterThan(0)
    expect(screen.getAllByText("invoice.pdf").length).toBeGreaterThan(0)

    const writeText = vi.spyOn(navigator.clipboard, "writeText")
    await user.click(screen.getByRole("button", { name: "Copy id: msg:telegram/1/-1000/4000" }))
    expect(writeText).toHaveBeenCalledWith("msg:telegram/1/-1000/4000")
    expect(screen.queryByText("Reference")).not.toBeInTheDocument()
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
    const starts = ["from:", "chat:", "date", "has:", "tag:"]
    for (const [i, key] of starts.entries()) expect(options[i]?.startsWith(key), `${i}: ${options[i]}`).toBe(true)
    expect(options.some((o) => o?.includes("date:["))).toBe(false)
    expect(within(list).getByText("Most used")).toBeInTheDocument()

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

  it("writes a query from plain words into the box once one search with a limit of 1 found it works", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await user.click(screen.getByRole("button", { name: "Write the query" }))
    expect(await screen.findByText("Choose a profile to search in.")).toBeInTheDocument()
    await choose(user, "Profile", "personal")
    await user.click(screen.getByRole("button", { name: "Write the query" }))
    expect(screen.getByText("Describe what you want to find first.")).toBeInTheDocument()
    const request = screen.getByLabelText("Describe what you're looking for")
    expect(request).toHaveFocus()

    await user.type(request, "photos from Ana Ruiz last week{Enter}")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await waitFor(() => expect(bar).toHaveValue('from:"Ana Ruiz" has:photo date>=7d'), { timeout: 4000 })
    expect(bar).toHaveFocus()
    expect(
      screen.getByText(/Claude Code, with your Claude plan, wrote the query below; it finds [\d,]+ results/),
    ).toBeInTheDocument()
    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith("tg", "personal", 'from:"Ana Ruiz" has:photo date>=7d', 1, 1)
    expect(useSearch.getState().answer).toBeNull()
  }, 15000)

  it("asks the agent once more when the tool refuses its query, and offers nothing when it fails again", async () => {
    const user = userEvent.setup()
    const draft = vi
      .spyOn(platform, "searchDraft")
      .mockResolvedValue({ kind: "query", query: "bogus:x", by: "claude-code" })
    vi.spyOn(platform, "searchStore").mockResolvedValue({
      kind: "queryError",
      reason: "query.unknown-field",
      message: 'search: query.unknown-field at position 1 — no field "bogus"',
      span: { start: 0, end: 5 },
    })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "bogus things{Enter}")
    expect(
      await screen.findByText(/wrote a query the tool does not accept, twice/, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(draft).toHaveBeenCalledTimes(2)
    expect(draft.mock.calls[1]?.[1]).toMatch(/^bogus things \(The query bogus:x was refused: query.unknown-field/)
    expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("")
  }, 15000)

  it("tries a part-of-name query without its patterns on a tool too old for them, without asking the agent again", async () => {
    const user = userEvent.setup()
    const draft = vi
      .spyOn(platform, "searchDraft")
      .mockResolvedValue({ kind: "query", query: "аренд* from:*Мила*", by: "claude-code" })
    const search = vi.spyOn(platform, "searchStore").mockImplementation(async (_id, _profile, query) =>
      query.includes("from:*")
        ? {
            kind: "queryError",
            reason: "query.unsupported-operator",
            message: "search: query.unsupported-operator at position 7 — from takes term, phrase",
            span: { start: 7, end: 18 },
          }
        : { kind: "hits", hits: [], hasMore: false, paged: false, notes: [], total: { value: 3, relation: "eq" } },
    )
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "аренда у Милы{Enter}")
    await waitFor(
      () => expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("аренд* from:Мила"),
      {
        timeout: 4000,
      },
    )
    expect(draft).toHaveBeenCalledTimes(1)
    expect(search.mock.calls.map((call) => call[2])).toEqual(["аренд* from:*Мила*", "аренд* from:Мила"])
  }, 15000)

  it("puts the query in the box when the store could not try it, and says why under Details", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchDraft").mockResolvedValue({ kind: "query", query: "plan", by: "claude-code" })
    vi.spyOn(platform, "searchStore").mockResolvedValue({
      kind: "failed",
      candidates: [],
      message: "another process holds the store",
    })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "the plan{Enter}")
    expect(await screen.findByText(/wrote the query below, but the tool could not try it just now/)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("plan")
    expect(screen.queryByText(/twice/)).not.toBeInTheDocument()
    await user.click(screen.getByText("Details"))
    expect(screen.getByText("another process holds the store")).toBeVisible()
  }, 15000)

  it("offers the people a name in a written query may mean, and puts the one picked in the box", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchDraft").mockResolvedValue({
      kind: "query",
      query: 'from:"Ярослав" has:photo',
      by: "claude-code",
    })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "фото от Ярослава{Enter}")
    expect(
      await screen.findByText(/"Ярослав" fits several people or nobody/, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    expect(bar).toHaveValue("")
    await user.click(screen.getByRole("button", { name: /^Ярослав Петров/ }))
    expect(bar).toHaveValue("from:702 has:photo")
  }, 15000)

  it("offers the near names when a written part-of-name pattern fits nobody", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchDraft").mockResolvedValue({
      kind: "query",
      query: "from:*Ярослва* has:photo",
      by: "claude-code",
    })
    vi.spyOn(platform, "searchStore").mockResolvedValue({
      kind: "failed",
      message: "from:*Ярослва* — no person fits; near: Ярослав Петров",
      candidates: [{ id: "702", label: "Ярослав Петров", field: "from" }],
    })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByLabelText("Describe what you're looking for"), "фото от Ярослвы{Enter}")
    const choice = await screen.findByRole("button", { name: /^Ярослав Петров/ }, { timeout: 4000 })
    await user.click(choice)
    expect(screen.getByRole("combobox", { name: "Search messages" })).toHaveValue("from:702 has:photo")
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
    await choose(user, "Profile", "personal")
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
    await choose(user, "Profile", "personal")
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

  it("offers memo's search harder only once allowed, and says whether the model reordered the hits", async () => {
    const user = userEvent.setup()
    const status = vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({ state: "ready", status: allowed })
    const used = { provider: "openai", model: "gpt-4o-mini" }
    let outcome: HarderOutcome = {
      applied: false,
      reason: "harder.no-key",
      why: "no key for the provider",
      ...used,
      costUsd: 0,
    }
    const harder = vi.spyOn(platform, "searchHarderRun").mockImplementation(async (id, query, limit) => {
      const plain = await platform.searchStore(id, null, query, limit, 1)
      if (plain.kind !== "hits") throw new Error("the mock answers hits")
      return { answer: { ...plain, paged: false, total: null }, outcome }
    })
    render(<SearchPage />)
    await choose(user, "Tool", "Memo")
    await user.type(screen.getByRole("combobox", { name: "Search notes" }), "plan{Enter}")
    expect(await screen.findByText("Showing 1–50 of 128 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByText("Sends your question and the first 30 results to Anthropic")).toBeInTheDocument()
    expect(status).toHaveBeenCalledWith("memo")

    await user.click(screen.getByRole("button", { name: "Search harder" }))
    expect(
      await screen.findByText("The usual order: there is no key for the provider, nothing was sent."),
    ).toBeInTheDocument()
    expect(harder).toHaveBeenCalledWith("memo", "plan", 50)
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Back to the usual order" }))
    expect(await screen.findByText("Showing 1–50 of 128 results", {}, { timeout: 3000 })).toBeInTheDocument()
    outcome = { applied: true, reason: null, why: null, ...used, costUsd: 0.0003 }
    await user.click(screen.getByRole("button", { name: "Search harder" }))
    expect(
      await screen.findByText(
        "Reordered by OpenAI gpt-4o-mini: the results that answer your question come first. It cost less than $0.01.",
      ),
    ).toBeInTheDocument()
  }, 15000)

  it("sends only the query of the results on screen, never text typed since", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({ state: "ready", status: allowed })
    const harder = vi.spyOn(platform, "searchHarderRun")
    render(<SearchPage />)
    await choose(user, "Tool", "Memo")
    const bar = screen.getByRole("combobox", { name: "Search notes" })
    await user.type(bar, "plan{Enter}")
    const button = await screen.findByRole("button", { name: "Search harder" }, { timeout: 3000 })
    await user.click(button)
    expect(harder).toHaveBeenLastCalledWith("memo", "plan", 50)
    await screen.findByText(/^Reordered by Anthropic/, {}, { timeout: 4000 })

    await user.type(bar, " secret draft")
    expect(screen.queryByRole("button", { name: "Back to the usual order" })).not.toBeInTheDocument()
    expect(harder).toHaveBeenCalledTimes(1)
  }, 15000)

  it("offers no search harder while the owner has not allowed it", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({ state: "ready", status: { ...allowed, on: false } })
    render(<SearchPage />)
    await choose(user, "Tool", "Memo")
    await user.type(screen.getByRole("combobox", { name: "Search notes" }), "plan{Enter}")
    expect(await screen.findByText("Showing 1–50 of 128 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Search harder" })).not.toBeInTheDocument()
  }, 15000)

  it("says which update a tool too old to search needs", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchStore").mockResolvedValue({ kind: "old", message: "unknown option '--offline'" })
    render(<SearchPage />)
    await choose(user, "Tool", "MAX")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "x{Enter}")
    expect(await screen.findByText("This page needs a newer MAX than 0.74.0.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update MAX" })).toBeInTheDocument()
    await user.click(screen.getByText("Details"))
    expect(screen.getByText("unknown option '--offline'")).toBeVisible()

    await choose(user, "Tool", "Telegram")
    await user.click(screen.getByRole("combobox", { name: "Tool" }))
    expect(await screen.findByRole("option", { name: "MAX — update to search" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  }, 15000)

  it("says a search out of time had a valid query, and searches again on Try again", async () => {
    const user = userEvent.setup()
    const search = vi
      .spyOn(platform, "searchStore")
      .mockResolvedValue({ kind: "timedOut", message: "search stopped at its time limit of 2s", seconds: 2 })
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.type(bar, "has:photo{Enter}")
    expect(await screen.findByText(/did not finish in 2 s\. The query is fine/)).toBeInTheDocument()
    expect(bar).not.toHaveAttribute("aria-invalid")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
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
    expect(await screen.findByText("The search did not run.")).toBeInTheDocument()
    await user.click(screen.getByText("Details"))
    expect(screen.getByText("the command failed; this is a bug")).toBeVisible()
    expect(screen.getByRole("button", { name: "Report this" })).toBeVisible()
  }, 15000)

  it("shows no results, not an error, for an empty answer that did not cover every chat", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchStore").mockResolvedValue({
      kind: "hits",
      hits: [],
      hasMore: false,
      paged: true,
      notes: [],
      total: null,
      coverage: { messages: 207_424, chats: 1380 },
    })
    render(<SearchPage />)
    await choose(user, "Tool", "MAX")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "zzq{Enter}")
    expect(await screen.findByText(/Nothing matches this search/)).toBeInTheDocument()
    expect(screen.getByText("Searched 207 424 messages in 1 380 chats")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Report this" })).not.toBeInTheDocument()
  }, 15000)

  it("puts the keys of the last searches first, and offers the tool's own values after a field", async () => {
    const user = userEvent.setup()
    const values = vi.spyOn(platform, "searchValues")
    render(<SearchPage />)
    await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await waitFor(() => expect(values).toHaveBeenCalledWith("tg", "personal", "chats"))
    const bar = screen.getByRole("combobox", { name: "Search messages" })

    await user.type(bar, "tag:work{Enter}")
    await waitFor(() => expect(useSearch.getState().usedKeys).toEqual({ tag: 1 }))
    await user.clear(bar)
    await user.click(bar)
    expect((await screen.findAllByRole("option"))[0]).toHaveTextContent(/^tag:/)
    await user.keyboard("{Escape}")
    await user.type(bar, "has:link date>=30d ")

    await user.type(bar, "chat:des")
    await user.click(await screen.findByRole("option", { name: /Design crit/ }))
    expect(bar).toHaveValue('has:link date>=30d chat:"-1001001" ')
    expect(bar).toHaveAccessibleDescription(/Names in this search: chat:"-1001001" Design crit/)
    await user.keyboard("{End}{Backspace}{Backspace}")
    expect(bar).toHaveValue('has:link date>=30d chat:"-1001001')
  }, 15000)

  it("turns a chat name that fits two chats into a choice that names one by id", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.type(bar, "date>=3d chat:kyrillic{Enter}")

    expect(await screen.findByText(/Pick the chat you meant below: every chat with "kyrillic"/)).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: /^kyrillic\s*@kyrillic/ }))
    expect(bar).toHaveValue('date>=3d chat:"-1001762030832"')
    expect(bar).toHaveAccessibleDescription(/Names in this search: chat:"-1001762030832" kyrillic/)
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith("tg", "personal", 'date>=3d chat:"-1001762030832"', 50, 1),
    )
  }, 15000)
})

describe("a name that fits several people", () => {
  it("offers everyone whose name holds it, the one cli-core left out too, and searches the one picked", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.type(bar, 'from:"Ярослав" has:photo{Enter}')

    expect(await screen.findByText(/everyone with "Ярослав" in their name/)).toBeInTheDocument()
    const choice = await screen.findByRole("button", { name: /^Ярослав Петров/ })
    expect(screen.getByRole("button", { name: /^Ярослав\s*@yar_one/ })).toBeInTheDocument()
    await user.click(choice)
    expect(bar).toHaveValue("from:702 has:photo")
    expect(bar).toHaveAccessibleDescription(/Names in this search: from:702 Ярослав Петров/)
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("tg", "personal", "from:702 has:photo", 50, 1))
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
