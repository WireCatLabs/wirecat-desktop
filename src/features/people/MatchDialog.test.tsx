import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { contactsOf, sameMark, sharedValue } from "./contacts"
import { PeoplePage } from "./PeoplePage"
import { useProfiles } from "./profiles"
import { usePeople } from "./store"

const openSergey = async () => {
  const user = userEvent.setup()
  render(<PeoplePage />)
  await user.click(await screen.findByRole("button", { name: "Review matches" }, { timeout: 4000 }))
  const card = screen.getByRole("article", { name: "Сергей · Сергей" })
  await user.click(within(card).getByRole("button", { name: "Details" }))
  const dialog = await screen.findByRole("dialog", { name: "Match details" })
  await within(dialog).findAllByText("+7 912 555-01-47", {}, { timeout: 4000 })
  return { user, dialog }
}

describe("Match details", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePeople.setState(usePeople.getInitialState(), true)
    useProfiles.getState().clear()
  })

  it("compares two people as the owner knows them, the shared phone marked on both, with no ids", async () => {
    const { dialog } = await openSergey()
    expect(within(dialog).getByText("Same phone number +7 912 555-01-47")).toBeInTheDocument()
    const sides = within(dialog).getAllByRole("region", { name: "Сергей" })
    expect(sides).toHaveLength(2)
    for (const side of sides) {
      expect(within(side).getByText("+7 912 555-01-47")).toHaveClass(...sameMark.split(" "))
      expect(within(side).getByText("matched")).toBeInTheDocument()
      expect(await within(side).findByText("Bitrix24 contact", {}, { timeout: 4000 })).toBeInTheDocument()
    }
    expect(within(sides[0] as HTMLElement).getByText("Northstar Logistics, Закупки")).toBeInTheDocument()
    expect(within(sides[0] as HTMLElement).getByText("Созвон по поставке")).toBeInTheDocument()
    for (const technical of ["person:", "bitrix24:", "northstar.example/contact", "17106", "initial", "Signal"])
      expect(dialog).not.toHaveTextContent(technical)
  })

  it("does not mark the accounts on a card personal, the scope memo gives every new account", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }, { timeout: 4000 }))
    const card = screen.getByRole("article", { name: "Сергей · Сергей" })
    await waitFor(() => expect(within(card).getAllByText("Bitrix24")).toHaveLength(2), { timeout: 4000 })
    expect(card).not.toHaveTextContent("personal")
  })

  it("opens the contact on its Bitrix24 portal", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const { user, dialog } = await openSergey()
    const side = within(dialog).getAllByRole("region", { name: "Сергей" })[1] as HTMLElement
    await user.click(await within(side).findByRole("button", { name: "Open in Bitrix24" }, { timeout: 4000 }))
    expect(open).toHaveBeenCalledWith("https://northstar.example/crm/contact/details/7733/")
  })

  it("merges from the dialog, which stays open and says what happened", async () => {
    // The mock store outlives each test: a real join would leave no match for the next one.
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const { user, dialog } = await openSergey()
    await user.click(within(dialog).getByRole("button", { name: "Merge" }))
    expect(decide).toHaveBeenCalledWith("person:33", "17106", "confirm", undefined)
    expect(await within(dialog).findByText("Joined into one person.", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(within(dialog).getAllByRole("region", { name: "Сергей" })).toHaveLength(2)
    expect(screen.getByRole("dialog", { name: "Match details" })).toBeVisible()
  })

  it("keeps them apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const { user, dialog } = await openSergey()
    await user.click(within(dialog).getByRole("button", { name: "Not the same" }))
    await user.type(within(dialog).getByRole("textbox", { name: "Why are they different people?" }), "namesakes{Enter}")
    expect(decide).toHaveBeenCalledWith("person:33", "17106", "reject", "namesakes")
    expect(await within(dialog).findByText(/Kept apart/, {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it("reads the profiles again when a decided match is opened once more", async () => {
    vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const { user, dialog } = await openSergey()
    await user.click(within(dialog).getByRole("button", { name: "Merge" }))
    await within(dialog).findByText("Joined into one person.", {}, { timeout: 4000 })
    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    const card = screen.getByRole("article", { name: "Сергей · Сергей" })
    await user.click(within(card).getByRole("button", { name: "Сергей · Сергей" }))
    const again = await screen.findByRole("dialog", { name: "Match details" })
    expect(await within(again).findByText("Northstar Logistics, Закупки", {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it("joins only the people ticked on the group's card", async () => {
    const merge = vi.spyOn(platform, "peopleMerge")
    const user = userEvent.setup()
    render(<PeoplePage />)
    await user.click(await screen.findByRole("button", { name: "Review matches" }, { timeout: 4000 }))
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
          phone: null,
          email: null,
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
          phone: "+34 600 111 222",
          email: "lena@example.org",
        },
      ],
    }
    expect(contactsOf(person, null, undefined)).toEqual({ phones: ["+34 600 111 222"], emails: ["lena@example.org"] })
  })
})
