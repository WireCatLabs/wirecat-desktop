import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { answerAtOnce } from "@/testing/mock-speed"
import { render, screen, waitFor, within } from "@/testing/render"
import { PeoplePage } from "./PeoplePage"
import { usePeople } from "./store"

// The mock store outlives each test, so these tests spy where a later one must not see an earlier decision.
type User = ReturnType<typeof userEvent.setup>
const table = () => screen.findByRole("table", { name: "Contacts" }, { timeout: 4000 })
const openPerson = async (user: User, name: string) => {
  await user.click(within(await table()).getAllByRole("button", { name })[0] as HTMLElement)
  return screen.findByRole("dialog", { name })
}
const openMatches = async (user: User) => {
  await user.click(await screen.findByRole("button", { name: "Review matches" }, { timeout: 4000 }))
  const region = await screen.findByRole("region", { name: "Possible duplicates" })
  await within(region).findAllByRole("article")
  return region
}
/** A card is drawn before its people load, under «No name yet», so its name comes later. */
const openMatch = async (user: User, name: string) =>
  within(await openMatches(user)).findByRole("article", { name }, { timeout: 4000 })

/** A listed person as a memo older than kinds gives it. */
const older = {
  displayName: null,
  kind: null,
  contact: null,
  phone: null,
  email: null,
  username: null,
  usernameSource: null,
  messagesFrom: null,
  lastContact: null,
}

describe("People", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePeople.setState(usePeople.getInitialState(), true)
  })

  it("lists people, the most written first, with their contact, and other kinds behind tabs", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const rows = await table()
    expect(within(rows).getByRole("button", { name: /You/ })).toBeInTheDocument()
    expect(within(rows).getByRole("button", { name: "@ivan_petrov" })).toBeInTheDocument()
    for (const noise of ["CZECH AIRLINES", "OpenWeather Team", "Без имени", /null/])
      expect(within(rows).queryByRole("button", { name: noise })).not.toBeInTheDocument()
    const lena = within(rows)
      .getAllByRole("row")
      .find((r) => r.textContent?.startsWith("Lena Ortiz")) as HTMLElement
    expect(lena).toHaveTextContent("lena@example.org")
    expect(lena).toHaveTextContent("993")
    expect(lena).not.toHaveTextContent("account")
    const kinds = screen.getByRole("group", { name: "Which people" })
    await user.click(
      await within(kinds).findByRole("radio", { name: "Newsletters & notifications 2" }, { timeout: 4000 }),
    )
    expect(screen.getByText("Bots, newsletters and no-reply senders.")).toBeInTheDocument()
    expect(within(kinds).getByRole("radio", { name: "Unsorted 5,002+" })).toBeInTheDocument()
    await waitFor(async () =>
      expect(within(await table()).getAllByRole("button", { name: "OpenWeather Team" })).toHaveLength(2),
    )
    await user.click(within(kinds).getByRole("radio", { name: /^Companies/ }))
    expect(
      await within(await table()).findByRole("button", { name: "CZECH AIRLINES" }, { timeout: 4000 }),
    ).toBeVisible()
  })

  it("on a memo older than kinds, lists everyone named, with a contact read from their accounts", async () => {
    const real = platform.peopleRead.bind(platform)
    vi.spyOn(platform, "peopleKinds").mockResolvedValue({})
    vi.spyOn(platform, "peopleRead").mockImplementation(async () => {
      const read = await real("person")
      if (read.kind !== "ready") return read
      const all = await Promise.all(["person", "organization", "automated", "unsorted"].map((k) => real(k as "person")))
      const people = all
        .flatMap((r) => (r.kind === "ready" ? r.people : []))
        .sort((a, b) => Number(a.ref.slice(7)) - Number(b.ref.slice(7)))
      return { ...read, kinded: false, people: people.map((p) => ({ ...p, ...older })) }
    })
    const user = userEvent.setup()
    render(<PeoplePage />)
    const rows = await table()
    expect(screen.queryByRole("group", { name: "Which people" })).not.toBeInTheDocument()
    expect(within(rows).getByRole("button", { name: "CZECH AIRLINES" })).toBeInTheDocument()
    expect(within(rows).queryByRole("button", { name: "Без имени" })).not.toBeInTheDocument()
    expect(within(rows).queryByRole("button", { name: /null/ })).not.toBeInTheDocument()
    const lena = within(rows)
      .getAllByRole("row")
      .find((r) => r.textContent?.startsWith("Lena Ortiz")) as HTMLElement
    expect(await within(lena).findByText("lena@example.org", {}, { timeout: 4000 })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "With a name" }))
    expect(
      (await within(await table()).findAllByRole("button", { name: "No name yet" }, { timeout: 4000 }))[0],
    ).toBeVisible()
  })

  it("reads one page at a time from memo, never everyone, and memo sorts and searches it", async () => {
    const page = vi.spyOn(platform, "peoplePage")
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    expect(page).toHaveBeenLastCalledWith({ kind: "person", page: 1, size: 50, query: "", sort: "interactions" })
    expect(within(await table()).getAllByRole("row")).toHaveLength(51)
    const pages = screen.getByRole("navigation", { name: "Pages" })
    expect(pages).toHaveTextContent(/^1–50 of 124/)
    await user.click(within(pages).getByRole("button", { name: "Page 2" }))
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    await waitFor(() => expect(pages).toHaveTextContent(/51–100 of 124/))

    await user.click(screen.getByRole("combobox", { name: "Order" }))
    await user.click(screen.getByRole("option", { name: "Most tasks" }))
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: "tasks" }))

    await user.type(screen.getByRole("searchbox"), "Lena")
    await waitFor(() => expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ query: "Lena" })), {
      timeout: 2000,
    })
    expect(page.mock.calls.filter(([a]) => a.query.startsWith("L")).length).toBeLessThan(4)
  })

  it("stacks phone and email, shows the messenger and handle when there is neither, and a quiet dash when nothing", async () => {
    render(<PeoplePage />)
    const rows = within(await table()).getAllByRole("row")
    const row = (name: string) => rows.find((r) => r.textContent?.startsWith(name)) as HTMLElement
    expect(row("Marta Gil")).toHaveTextContent(/\+34600111222.*marta@studio\.example/)
    expect(row("Kai Moreno")).toHaveTextContent("Telegram @kai_m")
    expect(within(row("Kai M.")).getByText("No phone, email or handle")).toHaveClass("sr-only")
    expect(row("Kai M.")).not.toHaveTextContent(/No contact/)
  })

  it("opens a person in a dialog with their accounts by source, marking only work ones", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await openPerson(user, "Lena Ortiz")
    const email = await within(lena).findByRole("region", { name: "Email" })
    expect(within(email).getByText("work")).toBeInTheDocument()
    expect(within(email).queryByText("personal")).not.toBeInTheDocument()
    expect(within(email).getByText(/joined by the same email address/)).toBeInTheDocument()
    expect(within(lena).getByRole("button", { name: "Undo" })).toBeInTheDocument()
  })

  it("says how many matches wait, and opens them on their own screen and back", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    expect(await screen.findByRole("heading", { name: "6 matches wait for you" }, { timeout: 4000 })).toBeVisible()
    const matches = await openMatches(user)
    expect(matches).toHaveTextContent("all their chats, mail, meetings and deals")
    expect(within(matches).getAllByRole("article")).toHaveLength(8)
    await user.click(screen.getByRole("button", { name: "All contacts" }))
    expect(await table()).toBeInTheDocument()
  })

  it("puts both people side by side by source, the account that ties them marked, never a raw id", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const card = within(matches).getByRole("article", { name: "Marta Gil (Studio) · Marta Gil" })
    const left = await within(card).findByRole("region", { name: "Marta Gil (Studio)" }, { timeout: 4000 })
    const tie = (await within(left).findByText("Bitrix24", {}, { timeout: 4000 })).closest("li") as HTMLElement
    expect(tie).toHaveTextContent("matched")
    expect(within(card).getByText("marta@studio.example", { selector: "p > span" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "2 people have it" })).toHaveAccessibleDescription(
      "2 people have it. Here now: Marta Gil (Studio) and Marta Gil.",
    )
    expect(card).not.toHaveTextContent("northstar.example")
    expect(card).not.toHaveTextContent("person:22")
    await user.click(within(card).getByRole("button", { name: "Marta Gil (Studio) · Marta Gil" }))
    const details = await screen.findByRole("dialog", { name: "Match details" })
    expect(await within(details).findByText("Same email address marta@studio.example")).toBeInTheDocument()
    expect(details).not.toHaveTextContent("bitrix24:")
  })

  it("confirms a waiting match as the owner, and the card stays and says so", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = await openMatch(user, "Lena Ortiz · Lena Ortiz")
    expect(within(card).getByRole("button", { name: "WireCat" })).toHaveAccessibleDescription(/found this itself/)
    const buttons = within(card)
      .getAllByRole("button")
      .map((b) => b.textContent)
    expect(buttons.slice(-3)).toEqual(["Details", "Same person", "Not the same"])
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(decide).toHaveBeenCalledWith("person:9", "17100", "confirm", undefined)
    expect(await within(card).findByText("Joined into one person.")).toBeInTheDocument()
  })

  it("says the shared number is hidden when no account shows it, and never makes one up", async () => {
    answerAtOnce()
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = await openMatch(user, "Lena Ortiz · Lena Ortiz")
    expect(await within(card).findByText("number hidden: accounts keep only its fingerprint")).toBeInTheDocument()
    expect(card).not.toHaveTextContent(/\+\d/)
  })

  it("keeps two people apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockRejectedValue(new Error("identity.stale"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = await openMatch(user, "Lena Ortiz · Lena Ortiz")
    await user.click(within(card).getByRole("button", { name: "Not the same" }))
    const why = within(card).getByRole("textbox", { name: "Why are they different people?" })
    expect(why).toHaveFocus()
    await user.click(within(card).getByRole("button", { name: "Keep them apart" }))
    expect(decide).not.toHaveBeenCalled()
    expect(why).toHaveFocus()
    expect(why).toHaveAccessibleDescription(/Say in a few words why they are different people/)
    await user.type(why, "two colleagues{Enter}")
    expect(decide).toHaveBeenCalledWith("person:9", "17100", "reject", "two colleagues")
    expect(await within(card).findByText(/changed since WireCat suggested this/)).toBeInTheDocument()
  })

  it("names the account that would move in words, and who suggested it", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const card = await within(matches).findByRole("article", { name: "Kai M. · Kai Moreno" }, { timeout: 4000 })
    expect(
      await within(card).findByText(/Moves MAX Kai M. to Kai Moreno. Only this account moves./, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "claude-code" })).toHaveAccessibleDescription(
      "The agent claude-code suggested this.",
    )
  })

  it("keeps apart only the ticked people of a group", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = await openMatch(user, "Konstantin Nikolaevich Loft Pro Max Semenov · Konstantin · K. Semenov")
    await user.click(within(card).getByRole("checkbox", { name: "K. Semenov is one of them" }))
    await user.click(within(card).getByRole("button", { name: "Not the same" }))
    await user.type(within(card).getByRole("textbox"), "two brothers{Enter}")
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1))
    expect(decide).toHaveBeenCalledWith("person:30", "17103", "reject", "two brothers")
  })

  it("shows an agent's split in words, and keeping it together sends the owner's reason, a default he may edit", async () => {
    const decide = vi.spyOn(platform, "peopleSplitDecide")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const card = within(matches).getByRole("article", { name: "Split off accounts of Viktor Example" })
    expect(card).toHaveTextContent("These accounts would become a new person:")
    expect(await within(card).findByText(/Mila Example/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(card).toHaveTextContent("Viktor's wife")
    expect(card).not.toHaveTextContent("max:7002")
    await user.click(within(card).getByRole("button", { name: "Keep together" }))
    const why = within(card).getByRole("textbox", { name: /Why do they belong together/ })
    expect(why).toHaveValue("I know they are the same person.")
    await user.clear(why)
    await user.click(within(card).getByRole("button", { name: "Keep together" }))
    expect(decide).not.toHaveBeenCalled()
    expect(within(card).getByRole("alert")).toHaveTextContent("Say in a few words why they belong together.")
    await user.type(why, "Mila uses his phone{Enter}")
    await waitFor(() => expect(decide).toHaveBeenCalledWith("person:40", "901", "reject", "Mila uses his phone"))
    expect(await within(card).findByText(/Kept together/)).toBeInTheDocument()
  })

  it("lists doubtful links above the contacts, and a split from there opens with the doubted account ticked", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    expect(panel).toHaveTextContent("people to check")
    expect(within(panel).getByRole("navigation", { name: "Pages of people to check" })).toBeInTheDocument()
    const viktor = within(panel)
      .getAllByRole("listitem")
      .find((row) => row.textContent?.startsWith("Viktor Example")) as HTMLElement
    expect(viktor).toHaveTextContent("The accounts carry different names.")
    expect(viktor).toHaveTextContent("MAX Mila Example")
    await user.click(within(viktor).getByRole("button", { name: "Split…" }))
    const dialog = await screen.findByRole("dialog", { name: "Move accounts to a new person" })
    await waitFor(() => expect(within(dialog).getByRole("checkbox", { name: /Mila Example/ })).toBeChecked())
  })

  it("shows three people who share a phone as one card, joins the two the owner ticks, then keeps the third apart", async () => {
    const merge = vi.spyOn(platform, "peopleMerge")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const title = "Konstantin Nikolaevich Loft Pro Max Semenov · Konstantin · K. Semenov"
    const card = within(matches).getByRole("article", { name: title })
    expect(within(card).getByRole("button", { name: "3 people have it" })).toHaveAccessibleDescription(
      "3 people have it. Here now: Konstantin Nikolaevich Loft Pro Max Semenov, Konstantin, and K. Semenov.",
    )
    await user.click(within(card).getByRole("button", { name: title }))
    const details = await screen.findByRole("dialog", { name: "Match details" })
    expect(within(details).getAllByRole("region")).toHaveLength(3)
    await user.click(within(details).getByRole("button", { name: "Close" }))

    const boxes = within(card).getAllByRole("checkbox")
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true, true])
    await user.click(within(card).getByRole("checkbox", { name: "K. Semenov is one of them" }))
    await user.click(within(card).getByRole("checkbox", { name: "Konstantin is one of them" }))
    await user.click(within(card).getByRole("button", { name: /^Join 1/ }))
    expect(merge).not.toHaveBeenCalled()
    expect(within(card).getByRole("alert")).toHaveTextContent("Tick at least two people.")
    expect(document.activeElement).toHaveAttribute("type", "checkbox")
    await user.click(within(card).getByRole("checkbox", { name: "Konstantin is one of them" }))
    await user.click(within(card).getByRole("button", { name: "Join 2" }))
    expect(merge).toHaveBeenCalledWith(["person:30", "person:31"])
    expect(
      await within(card).findByText(/Konstantin Nikolaevich Loft Pro Max Semenov and Konstantin are now one person/),
    ).toBeInTheDocument()
    await waitFor(() => expect(within(card).queryAllByRole("checkbox")).toHaveLength(0))
    await user.click(within(card).getByRole("button", { name: "Not the same" }))
    await user.type(within(card).getByRole("textbox"), "a namesake{Enter}")
    expect(await within(card).findByText(/Kept apart/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(card).toHaveTextContent("are now one person")
  })

  it("moves ticked accounts to a new person, never all of them, with nothing ticked at first", async () => {
    const unlink = vi.spyOn(platform, "peopleUnlink")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await openPerson(user, "Lena Ortiz")
    await user.click(await within(lena).findByRole("button", { name: "Move accounts to a new person" }))
    const dialog = screen.getByRole("dialog", { name: "Move accounts to a new person" })
    const boxes = within(dialog).getAllByRole("checkbox")
    expect(boxes.every((b) => !(b as HTMLInputElement).checked)).toBe(true)
    for (const b of boxes) await user.click(b)
    await user.click(within(dialog).getByRole("button", { name: "Move 3 accounts" }))
    expect(unlink).not.toHaveBeenCalled()
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Leave at least one account here.")
    await user.click(boxes[0] as HTMLElement)
    await user.click(boxes[1] as HTMLElement)
    await user.click(within(dialog).getByRole("button", { name: "Move 1 account" }))
    expect(unlink).toHaveBeenCalledWith("person:7", ["crm:acct/88"])
    await waitFor(() => expect(within(lena).getByRole("status")).toHaveTextContent(/moved to a new person/))
  })

  it("undoes a join after a dialog that names what goes back", async () => {
    const unmerge = vi.spyOn(platform, "peopleUnmerge")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await openPerson(user, "Lena Ortiz")
    expect(await within(lena).findByText(/From another person, joined by the same email address/)).toBeInTheDocument()
    await user.click(within(lena).getByRole("button", { name: "Undo" }))
    const dialog = screen.getByRole("dialog", { name: "Undo this join?" })
    expect(dialog).toHaveTextContent("These accounts go back to the person they were joined from")
    expect(dialog).not.toHaveTextContent("No name yet")
    expect(within(dialog).getByRole("listitem")).toHaveTextContent(/Email.*Lena Ortiz/)
    await user.click(within(dialog).getByRole("button", { name: "Undo the join" }))
    expect(unmerge).toHaveBeenCalledWith("person:7", "merge:7-12")
  })

  it("finds a person by an account they have, and opens them", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    await user.type(screen.getByRole("searchbox", { name: "Find by name, phone or address" }), "telegram:5120{Enter}")
    expect(await screen.findByText("telegram:5120 belongs to Kai Moreno.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open Kai Moreno" }))
    expect(await screen.findByRole("dialog", { name: "Kai Moreno" })).toBeInTheDocument()
  })

  it("says when an account belongs to no one", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    await user.type(
      screen.getByRole("searchbox", { name: "Find by name, phone or address" }),
      "nobody@example.org{Enter}",
    )
    expect(await screen.findByText("No one in Memo has nobody@example.org.")).toBeInTheDocument()
  })

  it("says when memo has more people and matches than the page read", async () => {
    vi.spyOn(platform, "peopleRead").mockResolvedValue({
      kind: "ready",
      people: [{ ref: "person:1", name: null, owner: true, tasks: 0, ...older }],
      peopleMore: true,
      matches: [],
      matchesMore: false,
      splits: [],
      kinded: false,
    })
    render(<PeoplePage />)
    expect(await screen.findByText(/Memo knows more people than this page read/)).toBeInTheDocument()
  })

  it("offers memo's update when it is too old", async () => {
    vi.spyOn(platform, "peopleRead").mockResolvedValue({ kind: "old", version: "0.131.63", need: "0.131.72" })
    render(<PeoplePage />)
    expect(await screen.findByText(/needs Memo 0.131.72 or newer/)).toBeInTheDocument()
  })

  it("after a join, the person merged away says whom they are part of now", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    const rows = within(await table()).getAllByRole("button", { name: "Lena Ortiz" })
    await user.click(rows[1] as HTMLElement)
    const lena9 = await screen.findByRole("dialog", { name: "Lena Ortiz" })
    const card = await within(lena9).findByRole("article", { name: "Lena Ortiz · Lena Ortiz" })
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(await within(lena9).findByText("This person is now part of Lena Ortiz.")).toBeInTheDocument()
  })

  // Last: it decides the mock's shared-mailbox card for the tests after it.
  it("shows everyone on one shared mailbox as one card, and gives the address to a company the owner names", async () => {
    const real = platform.peopleResolve.bind(platform)
    const resolve = vi
      .spyOn(platform, "peopleResolve")
      .mockResolvedValueOnce({
        kind: "refused",
        reason: "organization.unnamed",
        message: "info@harbour.example is a free mailbox; name the company or its organization",
        organizations: [],
      })
      .mockImplementation(real)
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const card = within(matches).getByRole("article", { name: "Harbour Studio · Olga Harbour · Pavel Harbour" })
    expect(within(card).getByText("shared mailbox")).toBeInTheDocument()
    expect(within(matches).getAllByText("shared mailbox")).toHaveLength(1)
    expect(within(matches).getAllByRole("button", { name: "Company mailbox" })).toHaveLength(1)

    await user.click(within(card).getByRole("button", { name: "Company mailbox" }))
    expect(await within(card).findByText(/free mail address/)).toBeInTheDocument()
    await user.click(within(card).getByRole("button", { name: "Give it to this company" }))
    expect(within(card).getByText("Type the company's name.")).toBeInTheDocument()
    await user.type(within(card).getByRole("textbox", { name: "Company name" }), "Harbour Studio")
    await user.click(within(card).getByRole("button", { name: "Give it to this company" }))
    expect(
      await within(card).findByText(/info@harbour.example is a company's mailbox now/, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(resolve.mock.calls.map(([, id, to]) => [id, to])).toEqual([
      ["17107", {}],
      ["17107", { name: "Harbour Studio" }],
      ["17108", { organization: "organization:3" }],
      ["17109", { organization: "organization:3" }],
    ])
  })
})
