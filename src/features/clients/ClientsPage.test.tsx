import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { clientsMock } from "@/platform/mock-clients"
import { render, screen, waitFor, within } from "@/testing/render"
import { ClientsPage } from "./ClientsPage"
import { useClients } from "./store"

// A mock of its own per test: a write still under way from the last test must not move a card in this one.
function freshMemo(based?: boolean, crmWrite = false) {
  const memo = clientsMock(based, crmWrite)
  vi.spyOn(platform, "clientsRead").mockImplementation(memo.clientsRead)
  vi.spyOn(platform, "clientsMove").mockImplementation(memo.clientsMove)
  vi.spyOn(platform, "clientsMapSet").mockImplementation(memo.clientsMapSet)
  vi.spyOn(platform, "clientsMapConfirm").mockImplementation(memo.clientsMapConfirm)
  vi.spyOn(platform, "clientsBaseEdit").mockImplementation(memo.clientsBaseEdit)
}

beforeEach(() => useClients.setState(useClients.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

const column = (name: RegExp) => screen.findByRole("region", { name }, { timeout: 4000 })
const card = (title: string) => screen.findByRole("button", { name: title }, { timeout: 4000 })

describe("Clients with a memo without base stages", () => {
  beforeEach(() => freshMemo(false))

  it("shows the deals by stage with memo's count and sum per column, and switches to the leads", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    const quote = await column(/^Quote, 1 card/)
    expect(within(quote).getByRole("button", { name: "Site for Northstar" })).toHaveTextContent("Northstar Labs")
    expect(quote).toHaveTextContent(/500[\s,.]?000/)
    await user.click(screen.getByRole("radio", { name: "Leads" }))
    expect(await column(/^contacted, 1 card/)).toHaveTextContent("Referral from Acme")
  })

  it("opens the pipeline with the most open deals, then the one last chosen while it is still listed", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ClientsPage />)
    expect(await screen.findByRole("button", { name: /^Pipeline/ }, { timeout: 4000 })).toHaveTextContent("Sales")
    await user.click(screen.getByRole("button", { name: /^Pipeline/ }))
    await user.click(screen.getByRole("option", { name: /Partners/ }))
    await waitFor(() => expect(screen.getByRole("button", { name: /^Pipeline/ })).toHaveTextContent("Partners"))
    unmount()
    render(<ClientsPage />)
    expect(await screen.findByRole("region", { name: /^Intro, 0 cards/ }, { timeout: 4000 })).toBeInTheDocument()
  })

  it("opens a card's details on a click", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.click(await card("Site for Northstar"))
    const dialog = await screen.findByRole("dialog", { name: "Site for Northstar" })
    expect(dialog).toHaveTextContent("Alice Moreno")
    expect(dialog).toHaveTextContent("Northstar site")
  })

  it("moves the owner's own deal to another stage with the keyboard, at once", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    const site = await card("Site for Northstar")
    site.focus()
    await user.keyboard(" {ArrowRight} ")
    expect(move).toHaveBeenCalledWith("deal", "deal:1", "Contract")
    await waitFor(async () =>
      expect(within(await column(/^Contract/)).getByRole("button", { name: "Site for Northstar" })).toBeInTheDocument(),
    )
  })

  it("puts a refused move back and says why on the card", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "clientsMove").mockRejectedValue(new Error("the portal refused the change"))
    render(<ClientsPage />)
    const support = await card("Support contract")
    support.focus()
    await user.keyboard(" {ArrowRight} ")
    await waitFor(async () =>
      expect(within(await column(/^Call/)).getByRole("button", { name: "Support contract" })).toHaveTextContent(
        "Not moved: the portal refused the change",
      ),
    )
  })

  it("keeps a CRM's pipeline read only, says why, and narrows it by the responsible person", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    await card("Site for Northstar")
    await user.click(screen.getByRole("button", { name: /^Pipeline/ }))
    await user.click(screen.getByRole("option", { name: /Northstar sales/ }))
    expect(await screen.findByText(/Read only: WireCat cannot run this CRM's own tool yet/)).toBeInTheDocument()
    const chairs = await card("Northstar: 40 office chairs")
    chairs.focus()
    await user.keyboard(" {ArrowRight} ")
    expect(move).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /^Responsible/ }))
    await user.click(screen.getByRole("option", { name: /Alice Moreno/ }))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Northstar: 40 office chairs" })).toBeNull())
    expect(screen.getByRole("button", { name: "Acme: meeting room" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "New, 1 of 2 shown" })).toHaveTextContent("1 of 2")
    expect(screen.getByRole("button", { name: "Clear responsible" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear pipeline" })).toBeNull()
  })

  it("offers Memo's install when it is missing", async () => {
    vi.spyOn(platform, "clientsRead").mockResolvedValue({ kind: "missing" })
    render(<ClientsPage />)
    expect(await screen.findByRole("button", { name: "Open Tools" })).toBeInTheDocument()
  })
})

describe("Clients on the base stages", () => {
  beforeEach(() => freshMemo())

  it("shows every pipeline's cards under the base stages, each with its real stage, and Unsorted first", async () => {
    render(<ClientsPage />)
    const quote = await column(/^Quote/)
    expect(within(quote).getByRole("button", { name: "Site for Northstar" })).toHaveTextContent("Quote · Sales")
    expect(
      within(await column(/^Call/)).getByRole("button", { name: "Northstar: 40 office chairs" }),
    ).toHaveTextContent("New · Northstar sales")
    const unsorted = await column(/^Unsorted/)
    expect(within(unsorted).getByRole("button", { name: "Northstar: printer lease" })).toHaveTextContent(
      "Waiting for payment · Northstar sales",
    )
    expect(within(unsorted).getByRole("button", { name: "Acme: showroom partnership" })).toHaveTextContent(
      "Suggested: Contract",
    )
  })

  it("moves the base set's own card at once to the column's stage", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    const site = await card("Site for Northstar")
    site.focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(move).toHaveBeenCalledWith("deal", "deal:1", "Call")
  })

  it("keeps a CRM's cards in place on a drop and says they change in the CRM", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    expect(await screen.findByText(/Read only: WireCat cannot run this CRM's own tool yet/)).toBeInTheDocument()
    expect(screen.getByText(/Sync · bitrix24 · northstar\.example/)).toBeInTheDocument()
    const chairs = await card("Northstar: 40 office chairs")
    chairs.focus()
    await user.keyboard(" {ArrowRight} ")
    expect(move).not.toHaveBeenCalled()
  })
})

describe("Clients on the base stages, once a CRM's cards can move", () => {
  beforeEach(() => freshMemo(true, true))

  it("asks which stage when the column holds several of the pipeline's, and offers the last pick first", async () => {
    const user = userEvent.setup()
    const move = vi.spyOn(platform, "clientsMove")
    render(<ClientsPage />)
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowRight} ")
    const picker = await screen.findByRole("dialog", { name: "Which stage of Quote?" })
    await user.click(within(picker).getByRole("radio", { name: /Invoice sent/ }))
    await user.click(within(picker).getByRole("button", { name: "Move" }))
    expect(move).toHaveBeenLastCalledWith("deal", expect.stringMatching(/^deal:/), "Invoice sent")
    await waitFor(async () =>
      expect(within(await column(/^Quote/)).getByRole("button", { name: "Northstar: 40 office chairs" })).toBeVisible(),
    )
    ;(await card("Northstar: 40 office chairs")).focus()
    await user.keyboard(" {ArrowLeft} ")
    await waitFor(() => expect(move).toHaveBeenLastCalledWith("deal", expect.stringMatching(/^deal:/), "New"))
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
    expect(await column(/^Unmapped/)).toHaveTextContent("Waiting for payment")
  })
})

describe("Mapping stages onto the base set", () => {
  beforeEach(() => freshMemo())

  const openMap = async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await card("Site for Northstar")
    await user.click(screen.getByRole("radio", { name: "Stages" }))
    await column(/^Unmapped/)
    return user
  }

  it("confirms every suggestion of the kind at once", async () => {
    const confirm = vi.spyOn(platform, "clientsMapConfirm")
    const user = await openMap()
    await user.click(screen.getByRole("button", { name: /^Confirm all/ }))
    expect(confirm).toHaveBeenCalledWith("deal", null)
    expect(await screen.findByText("Every suggestion is confirmed.", {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it("maps an unmapped stage by carrying it onto a base stage", async () => {
    const set = vi.spyOn(platform, "clientsMapSet")
    const user = await openMap()
    const waiting = within(await column(/^Unmapped/)).getByRole("button", {
      name: "Waiting for payment, Northstar sales",
    })
    waiting.focus()
    await user.keyboard(" {ArrowLeft} ")
    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^stage:/), expect.stringMatching(/^stage:/))
    await waitFor(async () => expect(await column(/^Lost/)).toHaveTextContent("Waiting for payment"))
  })

  it("renames a base stage in place, and will not remove the last stage of an outcome", async () => {
    const edit = vi.spyOn(platform, "clientsBaseEdit")
    const user = await openMap()
    await user.click(screen.getByRole("button", { name: "Rename Quote" }))
    const field = screen.getByRole("textbox", { name: "New name for Quote" })
    await user.clear(field)
    await user.type(field, "Offer{Enter}")
    expect(edit).toHaveBeenCalledWith("deal", { op: "rename", ref: expect.stringMatching(/^stage:/), name: "Offer" })
    expect(await column(/^Offer/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Remove Won" }))
    expect(await screen.findByText(/This is the last "Won" stage/)).toBeInTheDocument()
    expect(edit).toHaveBeenCalledTimes(1)
  })

  it("adds a won stage and refuses a name another stage has", async () => {
    const edit = vi.spyOn(platform, "clientsBaseEdit")
    const user = await openMap()
    await user.click(screen.getByRole("button", { name: "Add a stage" }))
    await user.type(screen.getByRole("textbox", { name: "Name of the new stage" }), "quote{Enter}")
    expect(await screen.findByText("Another stage has this name.")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Won" }))
    const field = screen.getByRole("textbox", { name: "Name of the new stage" })
    await user.clear(field)
    await user.type(field, "Paid{Enter}")
    expect(edit).toHaveBeenCalledWith("deal", { op: "add", name: "Paid", outcome: "won" })
    expect(await column(/^Paid/)).toBeInTheDocument()
  })
})
