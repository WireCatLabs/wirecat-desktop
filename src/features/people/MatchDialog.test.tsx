import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { contactsOf, sharedValue } from "./contacts"
import { PeoplePage } from "./PeoplePage"
import { useProfiles } from "./profiles"
import { usePeople } from "./store"

const openSergey = async () => {
  const user = userEvent.setup()
  render(<PeoplePage />)
  await user.click(await screen.findByRole("button", { name: "Review matches" }))
  const card = screen.getByRole("article", { name: "Сергей · 2 people" })
  await user.click(within(card).getByRole("button", { name: "Details" }))
  const dialog = await screen.findByRole("dialog", { name: "Match details" })
  await within(dialog).findAllByText("+7 912 555-01-47")
  return { user, dialog }
}

describe("Match details", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useProfiles.getState().clear()
  })

  it("compares two people as the owner knows them, the shared phone marked on both, with no ids", async () => {
    const { dialog } = await openSergey()
    expect(within(dialog).getByText("Same phone number +7 912 555-01-47")).toBeInTheDocument()
    const sides = within(dialog).getAllByRole("region", { name: "Сергей" })
    expect(sides).toHaveLength(2)
    for (const side of sides) {
      expect(within(side).getByText("+7 912 555-01-47")).toBeInTheDocument()
      expect(within(side).getByText("matched")).toBeInTheDocument()
      expect(await within(side).findByText("Bitrix24 contact")).toBeInTheDocument()
    }
    expect(within(sides[0] as HTMLElement).getByText("Northstar Logistics, Закупки")).toBeInTheDocument()
    expect(within(sides[0] as HTMLElement).getByText("Созвон по поставке")).toBeInTheDocument()
    for (const technical of ["person:", "bitrix24:", "northstar.example/contact", "17106", "initial", "Signal"])
      expect(dialog).not.toHaveTextContent(technical)
  })

  it("does not mark the accounts on a card personal, the scope memo gives every new account", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }))
    const card = screen.getByRole("article", { name: "Сергей · 2 people" })
    await waitFor(() => expect(within(card).getAllByText("Bitrix24")).toHaveLength(2))
    expect(card).not.toHaveTextContent("personal")
  })

  it("opens the contact on its Bitrix24 portal", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const { user, dialog } = await openSergey()
    const side = within(dialog).getAllByRole("region", { name: "Сергей" })[1] as HTMLElement
    await user.click(await within(side).findByRole("link", { name: "Open in Bitrix24" }))
    expect(open).toHaveBeenCalledWith("https://northstar.example/crm/contact/details/7733/")
  })

  it("merges from the dialog, which stays open and says what happened", async () => {
    // The mock store outlives each test: a real join would leave no match for the next one.
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const { user, dialog } = await openSergey()
    await user.click(within(dialog).getByRole("button", { name: "Merge" }))
    expect(decide).toHaveBeenCalledWith("person:33", "17106", "confirm", undefined)
    expect(await within(dialog).findByText("Joined into one person.")).toBeInTheDocument()
    expect(within(dialog).getAllByRole("region", { name: "Сергей" })).toHaveLength(2)
    expect(screen.getByRole("dialog", { name: "Match details" })).toBeVisible()
  })

  it("keeps them apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const { user, dialog } = await openSergey()
    await user.click(within(dialog).getByRole("button", { name: "Not the same" }))
    await user.type(within(dialog).getByRole("textbox", { name: "Why are they different people?" }), "namesakes{Enter}")
    expect(decide).toHaveBeenCalledWith("person:33", "17106", "reject", "namesakes")
    expect(await within(dialog).findByText(/Kept apart/)).toBeInTheDocument()
  })

  it("reads the profiles again when a decided match is opened once more", async () => {
    vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const { user, dialog } = await openSergey()
    await user.click(within(dialog).getByRole("button", { name: "Merge" }))
    await within(dialog).findByText("Joined into one person.")
    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    const card = screen.getByRole("article", { name: "Сергей · 2 people" })
    await user.click(within(card).getByRole("button", { name: "Сергей · 2 people" }))
    const again = await screen.findByRole("dialog", { name: "Match details" })
    expect(await within(again).findByText("Northstar Logistics, Закупки")).toBeInTheDocument()
  })

  it("joins only the people ticked on the group's card", async () => {
    const merge = vi.spyOn(platform, "peopleMerge")
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }))
    const title = "Konstantin Nikolaevich Loft Pro Max Semenov · Konstantin · K. Semenov"
    const card = screen.getByRole("article", { name: title })
    await user.click(within(card).getByRole("checkbox", { name: "K. Semenov is one of them" }))
    await user.click(within(card).getByRole("button", { name: title }))
    const dialog = await screen.findByRole("dialog", { name: "Match details" })
    await user.click(within(dialog).getByRole("button", { name: "Join 2" }))
    expect(merge).toHaveBeenCalledWith(["person:30", "person:31"])
  })
})

describe("what the people share", () => {
  const match = (signal: string, evidence: string[] = []) => ({
    id: "1",
    persons: ["person:1", "person:2"],
    identity: null,
    with: null,
    joins: "person",
    signal,
    candidates: [],
    reason: null,
    evidence,
    proposer: null,
    score: null,
    shared: null,
    mailbox: null,
  })

  it("never shows a reference memo gives as evidence, only a phone or an address", () => {
    const both = { phones: [], emails: ["ana@example.org"] }
    expect(sharedValue(match("guest-email", ["meeting:12"]), [both, both])).toBe("ana@example.org")
    expect(sharedValue(match("guest-email", ["meeting:12"]), [both, { phones: [], emails: [] }])).toBeNull()
    expect(sharedValue(match("phone", ["+7 912 555-01-47"]), [])).toBe("+7 912 555-01-47")
  })

  it("does not take an address with a phone's digits for the phone", () => {
    const a = { phones: ["+7 912 555-01-47"], emails: ["79125550147@mail.example"] }
    const b = { phones: [], emails: ["79125550147@mail.example"] }
    expect(sharedValue(match("phone"), [a, b])).toBeNull()
  })

  it("reads a phone only from a WhatsApp id that is a number", () => {
    const person = (id: string) => ({
      ref: "person:1",
      name: null,
      displayName: null,
      mergedInto: null,
      merges: [],
      matches: [],
      identities: [
        {
          identity: `whatsapp:${id}`,
          provider: "whatsapp",
          name: null,
          username: null,
          seenIn: [],
          method: null,
          linkedAt: null,
          movable: true,
          bot: false,
          phone: null,
          email: null,
          phones: [],
          emails: [],
        },
      ],
    })
    expect(contactsOf(person("34600111222@s.whatsapp.net"), null, undefined).phones).toEqual(["+34600111222"])
    expect(contactsOf(person("2389472398472@lid"), null, undefined).phones).toEqual([])
  })

  it("reads the phone and the address memo reports on an account", () => {
    const person = {
      ref: "person:1",
      name: null,
      displayName: null,
      mergedInto: null,
      merges: [],
      matches: [],
      identities: [
        {
          identity: "telegram:4411",
          provider: "telegram",
          name: null,
          username: null,
          seenIn: [],
          method: null,
          linkedAt: null,
          movable: true,
          bot: false,
          phone: "+34 600 111 222",
          email: "lena@example.org",
          phones: [],
          emails: [],
        },
      ],
    }
    expect(contactsOf(person, null, undefined)).toEqual({ phones: ["+34 600 111 222"], emails: ["lena@example.org"] })
  })
})

describe("A match by name", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useProfiles.getState().clear()
  })

  const byName = (companyMailbox: boolean) => {
    const read = platform.peopleRead.bind(platform)
    vi.spyOn(platform, "peopleRead").mockImplementation(async (kind) => {
      const out = await read(kind)
      if (out.kind !== "ready") return out
      const matches = out.matches.map((m) => (m.id === "17102" ? { ...m, signal: "name", evidence: [] } : m))
      return { ...out, matches, companyMailbox }
    })
  }

  it("gives the company the address the owner picks, and says which one memo refused", async () => {
    byName(true)
    const resolve = vi
      .spyOn(platform, "peopleResolve")
      .mockResolvedValueOnce({
        kind: "refused",
        reason: "identity.not-shared",
        message: "marta@studio.example is not an address of these two people at a company's domain",
        organizations: [],
      })
      .mockImplementation(async (ref) => ({
        kind: "done",
        organization: "organization:3",
        mailbox: "marta@studio.example",
        person: await platform.peopleShow(ref),
      }))
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }))
    const button = await screen.findByRole("button", { name: "Company address" })
    const card = button.closest("article") as HTMLElement
    expect(within(card).queryByRole("button", { name: "Company mailbox" })).not.toBeInTheDocument()
    await user.click(button)
    const ask = within(card).getByRole("group", { name: "Which of their addresses is the company's?" })
    const address = await within(ask).findByRole("button", { name: "marta@studio.example" })
    await user.click(address)
    expect(await within(card).findByText(/not one of their addresses at a company's domain/)).toBeInTheDocument()
    await user.click(within(ask).getByRole("button", { name: "marta@studio.example" }))
    expect(await within(card).findByText(/marta@studio.example is a company's mailbox now/)).toBeInTheDocument()
    expect(resolve.mock.calls.map(([, id, to]) => [id, to])).toEqual([
      ["17102", { mailbox: "marta@studio.example" }],
      ["17102", { mailbox: "marta@studio.example" }],
    ])
  })

  it("offers no company address before a memo that takes one", async () => {
    byName(false)
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }))
    await screen.findAllByRole("article")
    expect(screen.queryByRole("button", { name: "Company address" })).not.toBeInTheDocument()
  })
})

describe("One company", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useProfiles.getState().clear()
  })

  const withOneCompany = (oneCompany: boolean) => {
    const read = platform.peopleRead.bind(platform)
    vi.spyOn(platform, "peopleRead").mockImplementation(async (kind) => {
      const out = await read(kind)
      return out.kind === "ready" ? { ...out, oneCompany } : out
    })
  }
  const sergey = async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }))
    return { user, card: await screen.findByRole("article", { name: "Сергей · 2 people" }) }
  }
  const organized = (id: string) => ({
    kind: "organized" as const,
    organization: "organization:5",
    name: "Northstar Logistics",
    mailboxes: ["pro@northstar.example", "b2b@northstar.example"],
    people: usePeople.getState().matches.find((m) => m.id === id)?.persons ?? [],
    closed: [id],
  })

  it("gives the card's people to the company and says which addresses went to it", async () => {
    withOneCompany(true)
    const resolve = vi.spyOn(platform, "peopleOneCompany").mockImplementation(async (id) => organized(id))
    const { user, card } = await sergey()
    await user.click(within(card).getByRole("button", { name: "One company" }))
    expect(
      await within(card).findByText(
        "pro@northstar.example and b2b@northstar.example now belong to Northstar Logistics. They left the contacts.",
      ),
    ).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: "Same person" })).not.toBeInTheDocument()
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve.mock.calls[0]?.[1]).toEqual({})
  })

  it("asks for the company's name when memo cannot tell it, and sends the name back the same way", async () => {
    withOneCompany(true)
    const mailbox = vi.spyOn(platform, "peopleResolve")
    const resolve = vi
      .spyOn(platform, "peopleOneCompany")
      .mockResolvedValueOnce({
        kind: "refused",
        reason: "organization.unnamed",
        message: "name the company or its organization",
        organizations: [],
      })
      .mockImplementation(async (id) => organized(id))
    const { user, card } = await sergey()
    await user.click(within(card).getByRole("button", { name: "One company" }))
    await user.type(await within(card).findByLabelText("Company name"), "Northstar Logistics")
    await user.click(within(card).getByRole("button", { name: "Give it to this company" }))
    expect(await within(card).findByText(/now belong to Northstar Logistics/)).toBeInTheDocument()
    expect(resolve.mock.calls.map(([, to]) => to)).toEqual([{}, { name: "Northstar Logistics" }])
    expect(mailbox).not.toHaveBeenCalled()
  })

  it("says the people went to the company when memo moved no mail address", async () => {
    withOneCompany(true)
    vi.spyOn(platform, "peopleOneCompany").mockImplementation(async (id) => ({ ...organized(id), mailboxes: [] }))
    const { user, card } = await sergey()
    await user.click(within(card).getByRole("button", { name: "One company" }))
    expect(
      await within(card).findByText("They now belong to Northstar Logistics and left the contacts."),
    ).toBeInTheDocument()
  })

  it("says plainly when one of them is the owner", async () => {
    withOneCompany(true)
    vi.spyOn(platform, "peopleOneCompany").mockResolvedValue({
      kind: "refused",
      reason: "identity.owner",
      message: "person:1 is the owner",
      organizations: [],
    })
    const { user, card } = await sergey()
    await user.click(within(card).getByRole("button", { name: "One company" }))
    expect(await within(card).findByText(/One of them is you/)).toBeInTheDocument()
    expect(within(card).queryByLabelText("Company name")).not.toBeInTheDocument()
  })

  it("is not offered before a memo that makes people one company's", async () => {
    withOneCompany(false)
    const { card } = await sergey()
    expect(within(card).queryByRole("button", { name: "One company" })).not.toBeInTheDocument()
  })
})
