import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSync } from "@/features/tools"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { type CrmWriter, clientsMock, NORTHSTAR } from "@/platform/mock-clients"
import { useTools } from "@/shared/tools-store"
import { act, fireEvent, render, screen, waitFor, within } from "@/testing/render"
import type { Based } from "./api"
import { COLUMN_PAGE } from "./BaseBoard"
import { ClientsPage } from "./ClientsPage"
import { useClients } from "./store"

type SyncRun = ReturnType<typeof useSync.getState>["runs"][string]

// A mock of its own per test: a write still under way from the last test must not move a card in this one.
function freshMemo(writer: CrmWriter = "none") {
  const memo = clientsMock(writer)
  vi.spyOn(platform, "clientsRead").mockImplementation(memo.clientsRead)
  vi.spyOn(platform, "clientsMove").mockImplementation(memo.clientsMove)
  vi.spyOn(platform, "clientsScope").mockImplementation(memo.clientsScope)
  vi.spyOn(platform, "clientsScopeSet").mockImplementation(memo.clientsScopeSet)
  vi.spyOn(platform, "clientsMapSet").mockImplementation(memo.clientsMapSet)
  vi.spyOn(platform, "clientsMapConfirm").mockImplementation(memo.clientsMapConfirm)
  vi.spyOn(platform, "clientsBaseEdit").mockImplementation(memo.clientsBaseEdit)
}

// A detection started by one test resolves in a later one and replaces its tools: no test starts one.
// The sample CRMs' stage dialog has opened by itself already; "Confirming a CRM's stages" starts without that.
const PROMPTED = ["deal", "lead"].flatMap((k) => [`${k}:bitrix24:northstar.example`, `${k}:amocrm:acme.example`])

beforeEach(() => {
  useClients.setState({ ...useClients.getInitialState(), view: "board", prompted: PROMPTED }, true)
  useTools.setState({ checked: true })
})
afterEach(() => vi.restoreAllMocks())

const column = (name: RegExp) => screen.findByRole("region", { name }, { timeout: 4000 })
const card = (title: string) => screen.findByRole("button", { name: title }, { timeout: 4000 })

describe("Clients on the base stages", () => {
  beforeEach(() => freshMemo())

  it("opens again within a minute on the cards it showed, without asking memo or showing a skeleton", async () => {
    const read = vi.spyOn(platform, "clientsRead")
    const { unmount } = render(<ClientsPage />)
    await card("Site for Northstar")
    unmount()
    render(<ClientsPage />)
    expect(screen.getByRole("button", { name: "Site for Northstar" })).toBeInTheDocument()
    expect(screen.queryAllByRole("status").filter((s) => s.textContent === "Reading…")).toHaveLength(0)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it("reads the board again when a CRM's sync ends, even one started on the Tools page", async () => {
    const read = vi.spyOn(platform, "clientsRead")
    render(<ClientsPage />)
    await card("Site for Northstar")
    const run: SyncRun = {
      phase: "running",
      startedAt: 0,
      endedAt: null,
      stage: null,
      progress: null,
      stopping: false,
      summary: null,
      failure: null,
    }
    useSync.setState({ runs: { "tg:personal": run, "bitrix:work": run } })
    useSync.setState({ runs: { "tg:personal": { ...run, phase: "done" }, "bitrix:work": run } })
    expect(read).toHaveBeenCalledTimes(1)
    useSync.setState({ runs: { "tg:personal": { ...run, phase: "done" }, "bitrix:work": { ...run, phase: "done" } } })
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  it("opens a card's details on a click", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.click(await card("Site for Northstar"))
    const dialog = await screen.findByRole("dialog", { name: "Site for Northstar" })
    expect(dialog).toHaveTextContent("Alice Moreno")
    expect(dialog).toHaveTextContent("Northstar site")
  })

  it("asks for a CRM, and once one is installed, for its sign-in, while the board still shows", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await card("Site for Northstar")
    expect(screen.queryByRole("button", { name: "Install Bitrix24" })).toBeNull()
    await user.click(await screen.findByRole("button", { name: "Bitrix24 not installed", expanded: false }))
    expect(await screen.findByRole("button", { name: "Install Bitrix24" })).toBeInTheDocument()
    vi.spyOn(platform, "listProfiles").mockResolvedValue([])
    useTools.setState({
      checked: true,
      installs: {
        ...useTools.getState().installs,
        bitrix: [{ path: "/b24", version: "9.9.9", manager: "npm", problem: null }],
      },
    })
    await user.click(await screen.findByRole("button", { name: "Bitrix24: not signed in", expanded: false }))
    expect(await screen.findByRole("button", { name: "Sign in to Bitrix24" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Site for Northstar" })).toBeInTheDocument()
  })

  it("offers Memo's install when it is missing", async () => {
    vi.spyOn(platform, "clientsRead").mockResolvedValue({ kind: "missing" })
    render(<ClientsPage />)
    expect(await screen.findByRole("button", { name: "Install Memo" })).toBeInTheDocument()
  })

  it("shows every pipeline's cards under the base stages, each with its stage and pipeline, and Unsorted first", async () => {
    render(<ClientsPage />)
    const site = within(await column(/^Quote/)).getByRole("button", { name: "Site for Northstar" })
    expect(within(site).getByText("Quote")).toBeInTheDocument()
    expect(within(site).getByText("Sales")).toBeInTheDocument()
    const chairs = within(await column(/^Call/)).getByRole("button", { name: "Northstar: 40 office chairs" })
    expect(within(chairs).getByText("Northstar sales")).toBeInTheDocument()
    const unsorted = await column(/^Unsorted/)
    expect(within(unsorted).getByRole("button", { name: "Northstar: printer lease" })).toHaveTextContent(
      "Waiting for payment",
    )
  })

  it("shows memo's default lead stages in the interface's language and leaves out an empty Unsorted", async () => {
    useClients.setState({ kind: "lead" })
    render(<ClientsPage />)
    const call = within(await column(/^New/)).getByRole("button", { name: "Call from the site" })
    expect(within(call).getByText("New")).toBeInTheDocument()
    expect(within(call).getByText("Base stages")).toBeInTheDocument()
    expect(await column(/^Converted/)).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: /^Unsorted/ })).not.toBeInTheDocument()
    expect(screen.queryByText("Новый")).not.toBeInTheDocument()
  })

  it("keeps the names of a set the owner adopted, even one that matches a default name", async () => {
    useLanguage.setState({ choice: "ru" })
    try {
      render(<ClientsPage />)
      expect(await column(/^Won/)).toBeInTheDocument()
      expect(screen.queryByRole("region", { name: /^Выиграна/ })).not.toBeInTheDocument()
    } finally {
      useLanguage.setState({ choice: "en" })
    }
  })

  it("places a card under memo's suggestion, marked not confirmed, and its mark opens the stage dialog", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    const contract = await column(/^Contract/)
    const showroom = within(contract).getByRole("button", { name: "Acme: showroom partnership" })
    expect(showroom).toHaveTextContent("Not confirmed")
    await user.click(within(showroom).getByRole("button", { name: /Suggested for this stage: Contract/ }))
    expect(useClients.getState().mapOn).toBe("bitrix24:northstar.example")
    expect(useClients.getState().open).toBeNull()
  })

  it("shows a card's details beside it on keyboard focus, never the column's total, and Escape hides them", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    expect((await column(/^Quote/)).querySelector("h2")).not.toHaveTextContent("₽")
    const site = await card("Site for Northstar")
    document.documentElement.dataset.input = "keyboard"
    const before = await card("Northstar: 40 office chairs")
    act(() => before.focus())
    act(() => site.focus())
    const shown = () =>
      site
        .getAttribute("aria-describedby")
        ?.split(" ")
        .find((id) => id !== "clients-drag-hint")
    await waitFor(() => expect(shown()).toBeDefined())
    const details = document.getElementById(shown() ?? "") as HTMLElement
    expect(details).toHaveTextContent("Alice Moreno")
    expect(details).toHaveTextContent("Northstar site")
    await user.keyboard("{Escape}")
    expect(shown()).toBeUndefined()
    delete document.documentElement.dataset.input
  })

  it("counts every open card memo holds and says how many one read did not bring", async () => {
    const memo = clientsMock()
    vi.spyOn(platform, "clientsRead").mockImplementation(async (...args) => {
      const r = await memo.clientsRead(...args)
      return r.kind === "base" ? { ...r, cards: r.cards.filter((c) => c.title !== "Northstar: 40 office chairs") } : r
    })
    render(<ClientsPage />)
    const call = await column(/^Call/)
    expect(within(call).getByText("1 more not loaded")).toBeInTheDocument()
  })

  it("shows a column's first cards and more of them on Show more", async () => {
    const user = userEvent.setup()
    const memo = clientsMock()
    vi.spyOn(platform, "clientsRead").mockImplementation(async (...args) => {
      const r = await memo.clientsRead(...args)
      if (r.kind !== "base") return r
      const site = r.cards.find((c) => c.title === "Site for Northstar")
      if (!site) return r
      const more = Array.from({ length: COLUMN_PAGE + 5 }, (_, i) => ({
        ...site,
        ref: `deal:9${i}`,
        title: `Quote ${i}`,
      }))
      return { ...r, cards: [...r.cards, ...more] }
    })
    render(<ClientsPage />)
    const quote = await column(/^Quote/)
    expect(within(quote).queryByRole("button", { name: `Quote ${COLUMN_PAGE + 4}` })).toBeNull()
    await user.click(within(quote).getByRole("button", { name: /^Show \d+ more$/ }))
    expect(within(quote).getByRole("button", { name: `Quote ${COLUMN_PAGE + 4}` })).toBeInTheDocument()
    expect(within(quote).queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull()
  })

  it("changes a card's stage from its details, among its own pipeline's stages", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    await user.click(await card("Site for Northstar"))
    const dialog = await screen.findByRole("dialog", { name: "Site for Northstar" })
    await user.click(within(dialog).getByRole("combobox", { name: "Stage of Site for Northstar" }))
    await user.click(screen.getByRole("option", { name: "Contract" }))
    expect(move).toHaveBeenCalledWith("deal", "deal:1", "Contract", null)
  })

  it("offers in Responsible and Stage only what the chosen account holds", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await card("Site for Northstar")
    useClients.getState().setAccounts(["bitrix24:northstar.example"])
    const menu = () =>
      screen.getAllByRole("button", { name: /^Stage/ }).find((b) => b.getAttribute("aria-haspopup") === "listbox")
    await user.click(menu() as HTMLElement)
    const stages = screen.getAllByRole("option").map((o) => o.textContent)
    expect(stages).toContain("New")
    expect(stages).not.toContain("Quote")
    await user.keyboard("{Escape}")
    useClients.getState().setAccounts([])
    await user.click(menu() as HTMLElement)
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toContain("Quote")
  })

  it("moves the base set's own card at once to the column's stage", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    const site = await card("Site for Northstar")
    site.focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(move).toHaveBeenCalledWith("deal", "deal:1", "Call", null)
  })

  it("keeps a CRM's cards in place on a drop and says they change in the CRM", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    await user.click(await screen.findByRole("button", { name: "Read only" }))
    expect(await screen.findByText(/Read only: WireCat cannot run this CRM's own tool yet/)).toBeInTheDocument()
    expect(screen.getByText(/Sync · Bitrix24 · northstar\.example/)).toBeInTheDocument()
    const chairs = await card("Northstar: 40 office chairs")
    chairs.focus()
    await user.keyboard(" {ArrowRight} ")
    expect(move).not.toHaveBeenCalled()
  })
})

const WORK = { account: NORTHSTAR, profile: "work" }

describe("Clients on the base stages, once memo names b24 for the portal", () => {
  beforeEach(() => freshMemo("one"))

  it("asks which stage when several fit, offers the last pick first, and sends b24 the CRM's stage id, else its name", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowRight} ")
    const picker = await screen.findByRole("dialog", { name: "Which stage of Quote?" })
    await user.click(within(picker).getByRole("radio", { name: /Invoice sent/ }))
    await user.click(within(picker).getByRole("button", { name: "Move" }))
    expect(move).toHaveBeenLastCalledWith("deal", expect.stringMatching(/^deal:/), "C7:EXECUTING", WORK)
    await waitFor(async () =>
      expect(within(await column(/^Quote/)).getByRole("button", { name: "Northstar: 40 office chairs" })).toBeVisible(),
    )
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowLeft} ")
    await waitFor(() => expect(move).toHaveBeenLastCalledWith("deal", expect.stringMatching(/^deal:/), "New", WORK))
    await waitFor(async () =>
      expect(within(await column(/^Call/)).getByRole("button", { name: "Northstar: 40 office chairs" })).toBeVisible(),
    )
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowRight} ")
    const again = await screen.findByRole("dialog", { name: "Which stage of Quote?" })
    expect(within(again).getByRole("radio", { name: /Invoice sent/ })).toBeChecked()
  })

  it("puts the card back when no stage of its pipeline belongs to the column, with a link to map one", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowRight}{ArrowRight} ")
    expect(move).not.toHaveBeenCalled()
    const back = within(await column(/^Call/)).getByRole("button", { name: "Northstar: 40 office chairs" })
    expect(back).toHaveTextContent("Not moved: no stage of this card's pipeline belongs to this column yet")
    await user.click(within(back).getByRole("button", { name: "Map stages" }))
    const map = await screen.findByRole("dialog", { name: "Deal stages of your CRMs" })
    expect(within(map).getByRole("radio", { name: "Bitrix24 · northstar.example" })).toBeChecked()
    expect(await within(map).findByRole("region", { name: /^Unmapped/ })).toHaveTextContent("Waiting for payment")
  })
})

describe("Clients moving a CRM's cards through b24", () => {
  const toInvoiceSent = async (user: ReturnType<typeof userEvent.setup>) => {
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowRight} ")
    const picker = await screen.findByRole("dialog", { name: "Which stage of Quote?" })
    await user.click(within(picker).getByRole("radio", { name: /Invoice sent/ }))
    await user.click(within(picker).getByRole("button", { name: "Move" }))
  }

  it("puts the card back with b24's own reason when it refuses the move", async () => {
    freshMemo("one")
    vi.spyOn(platform, "clientsMove").mockRejectedValue(new Error("deal:3 is not a deal of this CRM account"))
    const user = userEvent.setup()
    render(<ClientsPage />)
    await toInvoiceSent(user)
    await waitFor(async () =>
      expect(
        within(await column(/^Call/)).getByRole("button", { name: "Northstar: 40 office chairs" }),
      ).toHaveTextContent("Not moved: deal:3 is not a deal of this CRM account"),
    )
  })

  it("writes nothing while memo names no profile, asks which one, and keeps the choice for the next move", async () => {
    freshMemo("choose")
    const move = vi.spyOn(platform, "clientsMove")
    const user = userEvent.setup()
    render(<ClientsPage />)
    await toInvoiceSent(user)
    const ask = await screen.findByRole("dialog", { name: "Which Bitrix24 profile changes northstar.example?" })
    expect(ask).toHaveTextContent("the owner chooses one")
    await user.click(within(ask).getByRole("button", { name: "Use it and move" }))
    expect(within(ask).getByText("Choose a profile first.")).toBeInTheDocument()
    expect(move).not.toHaveBeenCalled()
    await user.click(within(ask).getByRole("button", { name: "Cancel" }))
    expect(move).not.toHaveBeenCalled()
    expect(within(await column(/^Call/)).getByRole("button", { name: "Northstar: 40 office chairs" })).toBeVisible()

    await toInvoiceSent(user)
    const again = await screen.findByRole("dialog", { name: "Which Bitrix24 profile changes northstar.example?" })
    await user.click(within(again).getByRole("radio", { name: "sales" }))
    await user.click(within(again).getByRole("button", { name: "Use it and move" }))
    const sales = { account: NORTHSTAR, profile: "sales" }
    expect(move).toHaveBeenLastCalledWith("deal", expect.stringMatching(/^deal:/), "C7:EXECUTING", sales)
    await waitFor(async () =>
      expect(within(await column(/^Quote/)).getByRole("button", { name: "Northstar: 40 office chairs" })).toBeVisible(),
    )
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowLeft} ")
    await waitFor(() => expect(move).toHaveBeenLastCalledWith("deal", expect.stringMatching(/^deal:/), "New", sales))
    expect(screen.queryByRole("dialog", { name: /Bitrix24 profile/ })).toBeNull()
  })

  it("offers no scope of everyone's, and sets a stored one back to mine through b24, then syncs", async () => {
    freshMemo("one")
    vi.spyOn(platform, "clientsScope").mockResolvedValueOnce({
      kind: "settable",
      scope: "all",
      applied: { mode: "all" },
    })
    const set = vi.spyOn(platform, "clientsScopeSet")
    const sync = vi.spyOn(platform, "syncRun").mockResolvedValue()
    const user = userEvent.setup()
    render(<ClientsPage />)
    await card("Northstar: 40 office chairs")
    expect(screen.queryByRole("radio", { name: "Everyone's" })).toBeNull()
    const mine = await screen.findByRole("button", { name: "Only mine" })
    await waitFor(() => expect(mine).toBeEnabled())
    await user.click(mine)
    expect(set).toHaveBeenCalledWith(NORTHSTAR, "work", "mine")
    await waitFor(() => expect(sync).toHaveBeenCalledWith("bitrix", "work", expect.any(Function)))
  })
})

describe("Clients as a table", () => {
  beforeEach(() => {
    freshMemo("one")
    useClients.setState({ view: "table" })
  })
  const row = (title: string) =>
    screen.findByRole("button", { name: title }, { timeout: 4000 }).then((b) => b.closest("[data-row]") as HTMLElement)

  it("opens on the table, and remembers the board once chosen", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ClientsPage />)
    expect(await row("Site for Northstar")).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Deals" })).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Board" }))
    expect(await column(/^Quote/)).toBeInTheDocument()
    unmount()
    expect(JSON.parse(localStorage.getItem("wirecat.clients") ?? "{}").state.view).toBe("board")
  })

  it("sorts by amount, the largest first on a second click", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await row("Site for Northstar")
    await user.click(screen.getByRole("button", { name: "Sort by amount" }))
    await user.click(screen.getByRole("button", { name: "Sort by amount" }))
    const first = screen.getAllByRole("row").find((r) => within(r).queryAllByRole("cell").length > 0)
    expect(first).toHaveTextContent("Site for Northstar")
  })

  it("moves a card from its stage cell, and a refusal stays on its row", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    await row("Site for Northstar")
    await user.click(screen.getByRole("combobox", { name: "Stage of Site for Northstar" }))
    await user.click(screen.getByRole("option", { name: "Call" }))
    expect(move).toHaveBeenCalledWith("deal", "deal:1", "Call", null)
    await user.click(screen.getByRole("combobox", { name: "Stage of Northstar: 40 office chairs" }))
    await user.click(screen.getByRole("option", { name: "Contract" }))
    expect(move).toHaveBeenCalledTimes(1)
    expect(await row("Northstar: 40 office chairs")).toHaveTextContent(
      "Not moved: no stage of this card's pipeline belongs to this column yet",
    )
  })

  it("opens Map stages over the table, which stays when it closes", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await row("Site for Northstar")
    await user.click(screen.getAllByRole("button", { name: /^Map stages/ })[0] as HTMLElement)
    const map = await screen.findByRole("dialog", { name: "Deal stages of your CRMs" })
    await user.click(within(map).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("table", { name: "Deals" })).toBeInTheDocument()
  })
})

describe("Confirming a CRM's stages", () => {
  beforeEach(() => {
    freshMemo()
    useClients.setState({ prompted: [] })
  })

  it("opens the stage dialog by itself on the first read, once, and the notice stays until they are confirmed", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ClientsPage />)
    const map = await screen.findByRole("dialog", { name: "Deal stages of your CRMs" }, { timeout: 4000 })
    expect(within(map).getByRole("radio", { name: "Bitrix24 · northstar.example" })).toBeChecked()
    await user.click(within(map).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("button", { name: /stages to confirm/ })).toBeInTheDocument()
    unmount()

    render(<ClientsPage />)
    await card("Site for Northstar")
    expect(screen.queryByRole("dialog")).toBeNull()
    await user.click(screen.getByRole("button", { name: /stages to confirm/ }))
    expect(screen.getByText(/CRM stages wait for you to confirm them/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirm stages" }))
    expect(await screen.findByRole("dialog", { name: "Deal stages of your CRMs" })).toBeInTheDocument()
  })
})

describe("Accepting every CRM's suggestions from the notice", () => {
  beforeEach(() => freshMemo())

  const memoWith = (change: (read: Based) => Based) => {
    const memo = clientsMock("none")
    vi.spyOn(platform, "clientsRead").mockImplementation(async (kind) => {
      const r = await memo.clientsRead(kind)
      return r.kind === "base" ? change(r) : r
    })
    return vi.spyOn(platform, "clientsMapConfirm").mockImplementation(memo.clientsMapConfirm)
  }
  const acceptAll = async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.click(await screen.findByRole("button", { name: /stages to confirm/ }, { timeout: 4000 }))
    await user.click(await screen.findByRole("button", { name: /^Accept all \(\d+\)$/ }))
  }

  it("confirms every CRM's suggestions, leaves the owner's own pipelines, and the chip goes", async () => {
    const confirm = memoWith((r) => ({
      ...r,
      pipelines: [
        ...r.pipelines,
        ...r.pipelines.slice(0, 1).map((p) => ({ ...p, ref: "pipeline:own", account: null })),
      ],
      mapping: [
        ...r.mapping.filter((x) => x.base),
        ...r.mapping
          .filter((x) => x.base && !x.confirmed)
          .slice(0, 1)
          .map((x) => ({ ...x, ref: "stage:own", pipeline: "pipeline:own" })),
      ],
    }))
    await acceptAll()
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("deal", "pipeline:11"), { timeout: 4000 })
    expect(confirm).toHaveBeenCalledWith("deal", "pipeline:9")
    await waitFor(() => expect(screen.queryByRole("button", { name: /stages? to confirm/ })).toBeNull(), {
      timeout: 4000,
    })
    expect(confirm).not.toHaveBeenCalledWith("deal", "pipeline:own")
  })

  it("keeps the chip for a stage memo could not place, and says the suggestions are done", async () => {
    memoWith((r) => r)
    await acceptAll()
    expect(await screen.findByText("Every suggestion is confirmed.", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /1 stage to confirm/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Accept all/ })).toBeNull()
  })

  it("makes the stage dialog wait while the notice's Accept all runs", async () => {
    memoWith((r) => r)
    await acceptAll()
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm stages" }))
    const map = await screen.findByRole("dialog", { name: "Deal stages of your CRMs" })
    expect(within(map).getByRole("button", { name: /^Accept suggestions/ })).toBeDisabled()
  })
})

describe("Importing from a CRM", () => {
  beforeEach(() => freshMemo())
  const bitrix = (profiles: string[]) => {
    vi.spyOn(platform, "listProfiles").mockImplementation(async (id) =>
      id === "bitrix" ? profiles.map((name) => ({ name, signedIn: true })) : null,
    )
    const installs = [{ path: "/b24", version: "9.9.9", manager: "npm", problem: null }]
    useTools.setState({ checked: true, installs: { bitrix: installs } })
  }

  it("offers no import while no CRM is signed in: the notice asks for one", async () => {
    render(<ClientsPage />)
    await card("Site for Northstar")
    expect(await screen.findByRole("button", { name: "Bitrix24 not installed" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Import from/ })).toBeNull()
  })

  it("imports from the one signed-in profile with a plain button", async () => {
    const user = userEvent.setup()
    const sync = vi.spyOn(platform, "syncRun").mockResolvedValue()
    bitrix(["work"])
    render(<ClientsPage />)
    await user.click(await screen.findByRole("button", { name: "Import from Bitrix24" }, { timeout: 4000 }))
    await waitFor(() => expect(sync).toHaveBeenCalledWith("bitrix", "work", expect.any(Function)))
  })

  it("lists every profile when there are several, and runs nothing until one is picked", async () => {
    const user = userEvent.setup()
    const sync = vi.spyOn(platform, "syncRun").mockResolvedValue()
    bitrix(["work", "personal"])
    render(<ClientsPage />)
    await user.click(await screen.findByRole("button", { name: "Import from a CRM" }, { timeout: 4000 }))
    expect(sync).not.toHaveBeenCalled()
    await user.click(screen.getByRole("menuitem", { name: "Import from Bitrix24 · personal" }))
    await waitFor(() => expect(sync).toHaveBeenCalledWith("bitrix", "personal", expect.any(Function)))
  })

  it("explains an empty kind: nothing imported, the scope, and where the other kind is", async () => {
    const user = userEvent.setup()
    const memo = clientsMock()
    vi.spyOn(platform, "clientsRead").mockImplementation(async (kind) => {
      const answer = await memo.clientsRead(kind)
      return answer.kind === "base" ? { ...answer, cards: [] } : answer
    })
    render(<ClientsPage />)
    expect(await screen.findByText("Nothing is imported from a CRM yet.", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(
      screen.getByText("Only the deals of the CRM users you chose are imported, and the clients on them."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show leads" }))
    expect(useClients.getState().kind).toBe("lead")
  })
})

describe("Mapping a CRM's stages onto the base set", () => {
  beforeEach(() => freshMemo())

  const openMap = async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await card("Site for Northstar")
    await user.click(screen.getAllByRole("button", { name: /^Map stages/ })[0] as HTMLElement)
    const map = await screen.findByRole("dialog", { name: "Deal stages of your CRMs" })
    const column = (name: RegExp) => within(map).findByRole("region", { name }, { timeout: 4000 })
    const badge = async (name: RegExp, stage: string) =>
      within(await column(name)).getByRole("button", { name: new RegExp(`^${stage}, `) })
    const columnAction = async (column: string, action: string) => {
      await user.click(within(map).getByRole("button", { name: `${column}: actions` }))
      await user.click(screen.getByRole("menuitem", { name: action }))
    }
    return { user, map, column, badge, columnAction }
  }

  it("opens on the CRM with stages to sort, every unconfirmed stage in Unmapped with memo's suggestion", async () => {
    const { map, column } = await openMap()
    expect(within(map).getByRole("radio", { name: "Bitrix24 · northstar.example" })).toBeChecked()
    const unmapped = await column(/^Unmapped/)
    expect(unmapped).toHaveTextContent("Waiting for payment")
    expect(unmapped).toHaveTextContent("Lead in")
    expect(within(unmapped).getByRole("button", { name: "Confirm: Call" })).toBeVisible()
    expect(await column(/^Call/)).toHaveTextContent("New")
    expect(await column(/^Call/)).not.toHaveTextContent("Lead in")
    expect(map).not.toHaveTextContent("Brief")
  })

  it("confirms memo's suggestion for one stage with a click, and the keyboard goes on to the next one", async () => {
    const set = vi.spyOn(platform, "clientsMapSet")
    const { user, column } = await openMap()
    await user.click(within(await column(/^Unmapped/)).getByRole("button", { name: "Confirm: Call" }))
    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^stage:/), expect.stringMatching(/^stage:/))
    await waitFor(async () => expect(await column(/^Call/)).toHaveTextContent("Lead in"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm: Contract" })).toHaveFocus())
  })

  it("keeps every suggestion clickable while memo writes one, and writes them one after another", async () => {
    let release = () => {}
    const set = vi
      .spyOn(platform, "clientsMapSet")
      .mockImplementationOnce(() => new Promise<void>((done) => (release = done)))
    const { user, column } = await openMap()
    const unmapped = await column(/^Unmapped/)
    await user.click(within(unmapped).getByRole("button", { name: "Confirm: Call" }))
    const next = within(await column(/^Unmapped/)).getByRole("button", { name: "Confirm: Contract" })
    expect(next).toBeEnabled()
    await user.click(next)
    expect(set).toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(set).toHaveBeenCalledTimes(2))
  })

  it("accepts every suggestion of the CRM from the Unmapped column", async () => {
    const confirm = vi.spyOn(platform, "clientsMapConfirm")
    const { user, column } = await openMap()
    await user.click(within(await column(/^Unmapped/)).getByRole("button", { name: /^Accept suggestions \(\d+\)$/ }))
    expect(confirm).toHaveBeenCalled()
  })

  it("confirms only the chosen CRM's suggestions, and Unmapped goes once nothing waits", async () => {
    const confirm = vi.spyOn(platform, "clientsMapConfirm")
    const { user, map, column } = await openMap()
    await user.click(within(map).getByRole("radio", { name: "amocrm · acme.example" }))
    expect(await column(/^Unmapped/)).toHaveTextContent("Estimate")
    expect(map).not.toHaveTextContent("Waiting for payment")
    await user.click(within(map).getByRole("button", { name: "Accept suggestions (1)" }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith("deal", "pipeline:11")
    expect(await within(map).findByText("Every suggestion is confirmed.", {}, { timeout: 4000 })).toBeVisible()
    expect(within(map).queryByRole("region", { name: /^Unmapped/ })).toBeNull()
    expect(await column(/^Quote/)).toHaveTextContent("Estimate")
    await waitFor(() => expect(within(map).getByRole("radio", { name: "amocrm · acme.example" })).toHaveFocus())
  })

  it("puts a stage on another base stage than memo suggested, from the stage's own menu", async () => {
    const set = vi.spyOn(platform, "clientsMapSet")
    const { user, column } = await openMap()
    await user.click(within(await column(/^Unmapped/)).getByRole("button", { name: "Another stage for Lead in" }))
    await user.click(screen.getByRole("menuitem", { name: "Quote" }))
    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^stage:/), expect.stringMatching(/^stage:/))
    await waitFor(async () => expect(await column(/^Quote/)).toHaveTextContent("Lead in"))
  })

  it("maps a stage by carrying it onto a base stage, never back onto Unmapped", async () => {
    const set = vi.spyOn(platform, "clientsMapSet")
    const { user, column, badge } = await openMap()
    ;(await badge(/^Call/, "New")).focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(set).not.toHaveBeenCalled()
    ;(await badge(/^Unmapped/, "Waiting for payment")).focus()
    await user.keyboard(" {ArrowRight} ")
    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^stage:/), expect.stringMatching(/^stage:/))
    await waitFor(async () => expect(await column(/^Call/)).toHaveTextContent("Waiting for payment"))
    await waitFor(async () => expect(await badge(/^Call/, "Waiting for payment")).toHaveFocus())
  })

  it("renames a base stage in place, and will not remove the last stage of an outcome", async () => {
    const edit = vi.spyOn(platform, "clientsBaseEdit")
    const { user, map, column, columnAction } = await openMap()
    await columnAction("Quote", "Rename")
    const field = within(map).getByRole("textbox", { name: "New name for Quote" })
    await user.clear(field)
    await user.type(field, "Offer{Enter}")
    expect(edit).toHaveBeenCalledWith("deal", { op: "rename", ref: expect.stringMatching(/^stage:/), name: "Offer" })
    expect(await column(/^Offer/)).toBeInTheDocument()
    await columnAction("Won", "Remove")
    expect(await within(map).findByText(/This is the last "Won" stage/)).toBeInTheDocument()
    expect(edit).toHaveBeenCalledTimes(1)
  })

  it("cancels a rename with Escape and keeps the dialog open", async () => {
    const { map, columnAction } = await openMap()
    await columnAction("Quote", "Rename")
    const field = within(map).getByRole("textbox", { name: "New name for Quote" })
    // A dialog closes on an Escape whose default is left to run.
    expect(fireEvent.keyDown(field, { key: "Escape" })).toBe(false)
    expect(within(map).queryByRole("textbox", { name: "New name for Quote" })).toBeNull()
    expect(useClients.getState().mapOn).not.toBeNull()
  })

  it("adds a won stage and refuses a name another stage has", async () => {
    const edit = vi.spyOn(platform, "clientsBaseEdit")
    const { user, map, column } = await openMap()
    await user.click(within(map).getByRole("button", { name: "Add a stage" }))
    await user.type(within(map).getByRole("textbox", { name: "Name of the new stage" }), "quote{Enter}")
    expect(await within(map).findByText("Another stage has this name.")).toBeInTheDocument()
    await user.click(within(map).getByRole("radio", { name: "Won" }))
    const field = within(map).getByRole("textbox", { name: "Name of the new stage" })
    await user.clear(field)
    await user.type(field, "Paid{Enter}")
    expect(edit).toHaveBeenCalledWith("deal", { op: "add", name: "Paid", outcome: "won" })
    expect(await column(/^Paid/)).toBeInTheDocument()
  })
})
