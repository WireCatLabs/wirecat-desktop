import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { MailRule } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { AccountList } from "./Health"
import { MailRules } from "./MailRules"

const email = findTool("email")
if (!email) throw new Error("the catalog has no email tool")

const panel = () => screen.getByRole("dialog", { name: "Mail rules for work" })
const show = () => render(<MailRules tool={email} profile="work" open onClose={() => {}} />)

const domainRule = (domain: string, over: Partial<MailRule> = {}): MailRule => ({
  id: null,
  conditions: [{ key: "domain", value: domain }],
  action: "skip",
  tags: [],
  reason: null,
  protected: false,
  meetingNotes: null,
  source: "probe",
  decidedAt: "2026-11-01T10:00:00.000Z",
  recorded: null,
  ...over,
})

afterEach(() => vi.restoreAllMocks())

describe("an Email account's mail rules", () => {
  it("lists each rule with what it matches, what it does and who made it, for the account chosen", async () => {
    const list = vi.spyOn(platform, "mailRulesList")
    show()
    await within(panel()).findByText("from boss@example.com")
    const rows = within(panel()).getAllByRole("listitem")
    const row = (i: number) => rows[i] ?? panel()
    expect(list).toHaveBeenCalledWith("email", "work", 1, 25, undefined)
    expect(rows).toHaveLength(5)
    expect(within(row(0)).getByText("from boss@example.com")).toBeInTheDocument()
    expect(within(row(0)).getByText("Protected")).toBeInTheDocument()
    expect(within(row(1)).getByText("from keeper@telemost.yandex.ru")).toBeInTheDocument()
    expect(within(row(1)).getByText("Telemost meeting notes")).toBeInTheDocument()
    expect(within(row(1)).getByText("Protected")).toBeInTheDocument()
    expect(within(row(1)).getByText(/Added by you/)).toBeInTheDocument()
    expect(within(row(2)).getByText("domain shop.example and older than 365 days")).toBeInTheDocument()
    expect(within(row(2)).getByText("Envelope only")).toBeInTheDocument()
    expect(within(row(2)).getByText(/214 emails recorded/)).toBeInTheDocument()
    expect(within(row(3)).getByText("kind: social networks")).toBeInTheDocument()
    expect(within(row(3)).getByText(/Built-in kind/)).toBeInTheDocument()
    expect(within(row(4)).getByText(/From a Gmail filter/)).toBeInTheDocument()
    expect(within(panel()).queryByRole("button", { name: /add|remove|edit/i })).not.toBeInTheDocument()
  })

  it("says there are no rules yet, with the command to add one above", async () => {
    vi.spyOn(platform, "mailRulesList").mockResolvedValue({ result: "listed", rules: [], total: 0 })
    show()
    expect(await within(panel()).findByText("No rules yet")).toBeInTheDocument()
    expect(within(panel()).getByText("mail work rules add --do meeting-notes:telemost")).toBeInTheDocument()
  })

  it("shows the tool's failure with Try again, which reads the rules again", async () => {
    const list = vi.spyOn(platform, "mailRulesList").mockResolvedValue({
      result: "failed",
      message: "another mail sync holds the store",
      code: "store_busy",
      reason: null,
    })
    show()
    expect(await within(panel()).findByText("Could not read the mail rules.")).toBeInTheDocument()
    list.mockResolvedValue({ result: "listed", rules: [], total: 0 })
    await userEvent.click(within(panel()).getByRole("button", { name: "Try again" }))
    expect(await within(panel()).findByText("No rules yet")).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it("asks for an update when Email has no rules list yet", async () => {
    vi.spyOn(platform, "mailRulesList").mockResolvedValue({
      result: "failed",
      message: "This version cannot list mail rules yet.",
      code: "needs_update",
      reason: null,
    })
    show()
    expect(await within(panel()).findByText(/cannot list mail rules yet\. Update it/)).toBeInTheDocument()
    expect(within(panel()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    expect(within(panel()).queryByText(/rules add/)).not.toBeInTheDocument()
  })

  it("pages a long list through the pager", async () => {
    const list = vi.spyOn(platform, "mailRulesList")
    list.mockImplementation(async (_id, _profile, page) => ({
      result: "listed",
      total: 60,
      rules: Array.from({ length: page === 3 ? 10 : 25 }, (_, i) =>
        domainRule(`p${page}-${i}.example.test`, { id: page * 100 + i }),
      ),
    }))
    show()
    expect(await within(panel()).findByText("domain p1-0.example.test")).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole("button", { name: /next/i }))
    expect(await within(panel()).findByText("domain p2-0.example.test")).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith("email", "work", 2, 25, undefined)
  })

  it("keeps the shown page and its pager while the next page is read", async () => {
    const rows = (page: number) =>
      Array.from({ length: 25 }, (_, i) => domainRule(`p${page}-${i}.example.test`, { id: page * 100 + i }))
    const list = vi.spyOn(platform, "mailRulesList")
    list.mockResolvedValueOnce({ result: "listed", total: 60, rules: rows(1) })
    list.mockReturnValueOnce(new Promise(() => {}))
    show()
    expect(await within(panel()).findByText("domain p1-0.example.test")).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole("button", { name: /next/i }))
    expect(list).toHaveBeenLastCalledWith("email", "work", 2, 25, undefined)
    expect(within(panel()).getByText("domain p1-0.example.test")).toBeInTheDocument()
    expect(within(panel()).getByRole("button", { name: /next/i })).toBeInTheDocument()
  })

  it("searches every rule through the tool, from page 1, and pages what it found", async () => {
    const all = Array.from({ length: 80 }, (_, i) =>
      domainRule(`n${i}.example.test`, { id: i, reason: i % 2 === 0 ? `Рассылка ${i}` : null }),
    )
    const list = vi.spyOn(platform, "mailRulesList").mockImplementation(async (_id, _profile, page, limit, query) => {
      const found = all.filter((r) => !query || (r.reason ?? "").toLowerCase().includes(query.toLowerCase()))
      return { result: "listed", total: found.length, rules: found.slice((page - 1) * limit, page * limit) }
    })
    show()
    expect(await within(panel()).findByText("1–25 of 80")).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole("button", { name: "Page 3" }))
    expect(await within(panel()).findByText("domain n50.example.test")).toBeInTheDocument()

    await userEvent.type(within(panel()).getByRole("searchbox", { name: "Search the mail rules" }), "рассылка")
    expect(await within(panel()).findByText("1–25 of 40")).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith("email", "work", 1, 25, "рассылка")
    expect(within(panel()).getByText("domain n0.example.test")).toBeInTheDocument()
    expect(within(panel()).queryByText("domain n1.example.test")).not.toBeInTheDocument()
    expect(list.mock.calls.filter((c) => c[4] !== undefined)).toHaveLength(1)
  })

  it("hides the pager when what the search found fits one page", async () => {
    vi.spyOn(platform, "mailRulesList").mockImplementation(async (_id, _profile, _page, _limit, query) => ({
      result: "listed",
      total: query ? 3 : 60,
      rules: Array.from({ length: query ? 3 : 25 }, (_, i) => domainRule(`r${i}.example.test`, { id: i })),
    }))
    show()
    expect(await within(panel()).findByRole("navigation", { name: "Pages of mail rules" })).toBeInTheDocument()
    await userEvent.type(within(panel()).getByRole("searchbox"), "r1")
    await waitFor(() =>
      expect(within(panel()).queryByRole("navigation", { name: "Pages of mail rules" })).not.toBeInTheDocument(),
    )
  })

  it("says nothing was found, apart from having no rules, and Clear the search brings them back", async () => {
    vi.spyOn(platform, "mailRulesList").mockImplementation(async (_id, _profile, _page, _limit, query) =>
      query
        ? { result: "listed", total: 0, rules: [] }
        : { result: "listed", total: 1, rules: [domainRule("shop.example")] },
    )
    show()
    await within(panel()).findByText("domain shop.example")
    await userEvent.type(within(panel()).getByRole("searchbox"), "zzz")
    expect(await within(panel()).findByText("Nothing found")).toBeInTheDocument()
    expect(within(panel()).queryByText("No rules yet")).not.toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole("button", { name: "Clear the search" }))
    expect(await within(panel()).findByText("domain shop.example")).toBeInTheDocument()
    expect(within(panel()).getByRole("searchbox")).toHaveValue("")
  })
})

describe("an Email account row", () => {
  it("opens the mail rules in a dialog from a button with their count", async () => {
    vi.spyOn(platform, "syncLast").mockResolvedValue({ at: null, left: null, known: true, live: false })
    render(<AccountList tool={email} profiles={[{ name: "work", signedIn: true }]} onReload={() => undefined} />)
    const button = await screen.findByRole("button", { name: "Rules · 5" })
    expect(button).toHaveAttribute("title", "Open the mail rules for work")
    await userEvent.click(button)
    expect(await within(panel()).findByText("from boss@example.com")).toBeInTheDocument()
  })
})
