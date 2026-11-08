import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { ClientsPage } from "./ClientsPage"

afterEach(() => vi.restoreAllMocks())

const column = (name: RegExp) => screen.findByRole("region", { name }, { timeout: 4000 })
const card = (title: string) => screen.findByRole("button", { name: title }, { timeout: 4000 })

describe("Clients", () => {
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
