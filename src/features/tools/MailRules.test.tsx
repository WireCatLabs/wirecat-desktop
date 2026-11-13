import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { render, screen, within } from "@/testing/render"
import { MailRules } from "./MailRules"

const email = findTool("email")
if (!email) throw new Error("the catalog has no email tool")

const panel = () => screen.getByRole("region", { name: "Mail rules for work" })
const show = () => render(<MailRules tool={email} profile="work" onClose={() => {}} />)

afterEach(() => vi.restoreAllMocks())

describe("an Email account's mail rules", () => {
  it("lists each rule with what it matches, what it does and who made it, for the account chosen", async () => {
    const list = vi.spyOn(platform, "mailRulesList")
    show()
    await within(panel()).findByText("from boss@example.com")
    const rows = within(panel()).getAllByRole("listitem")
    const row = (i: number) => rows[i] ?? panel()
    expect(list).toHaveBeenCalledWith("email", "work", 1, 25)
    expect(rows).toHaveLength(5)
    expect(within(row(0)).getByText("from boss@example.com")).toBeInTheDocument()
    expect(within(row(0)).getByText("Protected")).toBeInTheDocument()
    expect(within(row(1)).getByText("from keeper@telemost.yandex.ru")).toBeInTheDocument()
    expect(within(row(1)).getByText("Telemost meeting notes")).toBeInTheDocument()
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
    expect(
      within(panel()).getByText(/rules add --sender keeper@telemost\.yandex\.ru .*--meeting-notes telemost/),
    ).toBeInTheDocument()
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
      rules: Array.from({ length: page === 3 ? 10 : 25 }, (_, i) => ({
        id: page * 100 + i,
        conditions: [{ key: "domain", value: `p${page}-${i}.example.test` }],
        action: "skip",
        tags: [],
        reason: null,
        protected: false,
        meetingNotes: null,
        source: "probe",
        decidedAt: "2026-11-01T10:00:00.000Z",
        recorded: null,
      })),
    }))
    show()
    expect(await within(panel()).findByText("domain p1-0.example.test")).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole("button", { name: /next/i }))
    expect(await within(panel()).findByText("domain p2-0.example.test")).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith("email", "work", 2, 25)
  })

  it("keeps the shown page and its pager while the next page is read", async () => {
    const rows = (page: number) =>
      Array.from({ length: 25 }, (_, i) => ({
        id: page * 100 + i,
        conditions: [{ key: "domain", value: `p${page}-${i}.example.test` }],
        action: "skip",
        tags: [],
        reason: null,
        protected: false,
        meetingNotes: null,
        source: null,
        decidedAt: "2026-11-01T10:00:00.000Z",
        recorded: null,
      }))
    const list = vi.spyOn(platform, "mailRulesList")
    list.mockResolvedValueOnce({ result: "listed", total: 60, rules: rows(1) })
    list.mockReturnValueOnce(new Promise(() => {}))
    show()
    expect(await within(panel()).findByText("domain p1-0.example.test")).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole("button", { name: /next/i }))
    expect(list).toHaveBeenLastCalledWith("email", "work", 2, 25)
    expect(within(panel()).getByText("domain p1-0.example.test")).toBeInTheDocument()
    expect(within(panel()).getByRole("button", { name: /next/i })).toBeInTheDocument()
  })
})
