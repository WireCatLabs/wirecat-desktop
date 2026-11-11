import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useGroups } from "@/features/groups"
import { platform } from "@/platform/bridge"
import { answerAtOnce } from "@/testing/mock-speed"
import { act, render, screen, waitFor, within } from "@/testing/render"
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
  bot: false,
}

describe("People", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePeople.setState(usePeople.getInitialState(), true)
  })

  // Before the match tests: they merge this person into another.
  it("lists every phone and address of a CRM contact in the person's card, each with a link", async () => {
    render(<PeoplePage />)
    await table()
    act(() => usePeople.getState().reveal("person:30"))
    const dialog = await screen.findByRole("dialog", {}, { timeout: 8000 })
    expect(await within(dialog).findByRole("link", { name: /\+34 910 000 334/ }, { timeout: 8000 })).toHaveAttribute(
      "href",
      "tel:+34910000334",
    )
    expect(within(dialog).getByRole("link", { name: /konstantin@mail.example/ })).toHaveAttribute(
      "href",
      "mailto:konstantin@mail.example",
    )
    expect(within(dialog).getByRole("button", { name: "Copy +34 910 000 333" })).toBeInTheDocument()
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
    expect(pages).toHaveTextContent(/^1–50 of 131/)
    await user.click(within(pages).getByRole("button", { name: "Page 2" }))
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    await waitFor(() => expect(pages).toHaveTextContent(/51–100 of 131/))

    await user.click(screen.getByRole("combobox", { name: "Order" }))
    await user.click(screen.getByRole("option", { name: "Most tasks" }))
    expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: "tasks" }))

    await user.type(screen.getByRole("searchbox"), "Lena")
    await waitFor(() => expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ query: "Lena" })), {
      timeout: 2000,
    })
    expect(page.mock.calls.filter(([a]) => a.query.startsWith("L")).length).toBeLessThan(4)
  })

  it("shows the phone and the email one under the other, and names the messenger of an account with no number", async () => {
    render(<PeoplePage />)
    const rows = within(await table()).getAllByRole("row")
    const row = (name: string) => rows.find((r) => r.textContent?.startsWith(name)) as HTMLElement
    expect(within(row("Marta Gil")).getByText("+34600111222")).toBeVisible()
    expect(within(row("Marta Gil")).getByText("marta@studio.example")).toBeVisible()
    expect(row("Kai Moreno")).toHaveTextContent("Telegram@kai_m")
    expect(within(row("Kai Moreno")).getByText("Telegram")).toHaveClass("sr-only")
    await waitFor(() => expect(row("Kai M.")).toHaveTextContent(/Kai M\.MAX/))
    await waitFor(() => expect(row("Eky")).toHaveTextContent(/EkyWhatsApp/))
    expect(row("Eky")).not.toHaveTextContent(/@lid/)
  })

  it("marks a bot at the end of its name only when every account is a bot", async () => {
    render(<PeoplePage />)
    const rows = within(await table()).getAllByRole("row")
    const row = (name: string) => rows.find((r) => r.textContent?.startsWith(name)) as HTMLElement
    expect(await within(row("Бездушная Машина")).findByText("Bot", {}, { timeout: 4000 })).toHaveClass("sr-only")
    await waitFor(() => expect(row("Dmitry Volkov")).toHaveTextContent("@dvolkov"))
    expect(within(row("Dmitry Volkov")).queryByText("Bot")).not.toBeInTheDocument()
  })

  it("opens a person in a dialog with their accounts by source, marking personal and work ones", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await openPerson(user, "Lena Ortiz")
    const email = await within(lena).findByRole("region", { name: "Email" })
    expect(within(email).getByText("work account")).toBeInTheDocument()
    expect(within(email).getByText("personal account")).toBeInTheDocument()
    expect(within(email).getByText(/joined by the same email address/)).toBeInTheDocument()
    expect(within(lena).getByRole("button", { name: "Undo" })).toBeInTheDocument()
  })

  it("shows each account with a readable name, its profiles and a bot mark, and unlinks one after a confirmation", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await act(() => useGroups.getState().load())
    act(() => usePeople.getState().reveal("person:46"))
    const dmitry = await screen.findByRole("dialog", { name: "Dmitry Volkov" }, { timeout: 4000 })
    const telegram = await within(dmitry).findByRole("region", { name: "Telegram" })
    await waitFor(() => expect(telegram).toHaveTextContent("Seen in: personal, work"), { timeout: 4000 })
    const bot = within(telegram).getByText("Sirgris Personal Bot").closest("li") as HTMLElement
    expect(within(bot).getByText("bot")).toBeInTheDocument()
    const max = within(dmitry).getByRole("region", { name: "MAX" })
    expect(max).toHaveTextContent("No name yet")
    expect(within(max).queryByText(".")).not.toBeInTheDocument()
    await user.click(within(bot).getByRole("button", { name: "Unlink Sirgris Personal Bot from this person" }))
    const confirm = await screen.findByRole("dialog", { name: "Move accounts to a new person" })
    await waitFor(() => expect(within(confirm).getByRole("checkbox", { name: /Sirgris Personal Bot/ })).toBeChecked())
    expect(within(confirm).getByRole("checkbox", { name: /Dmitry/ })).not.toBeChecked()
    expect(confirm).toHaveTextContent("The new person will be called Sirgris Personal Bot.")
  })

  it("lists the tasks assigned to a person in their card", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const you = await openPerson(user, "You")
    expect(await within(you).findByRole("heading", { name: /^Tasks/ }, { timeout: 4000 })).toBeInTheDocument()
    expect(
      (await within(you).findAllByRole("button", { name: /^(OPS|HRB)-\d+/ }, { timeout: 4000 })).length,
    ).toBeGreaterThan(0)
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
    const card = await within(matches).findByRole(
      "article",
      { name: "Marta Gil (Studio) · Marta Gil" },
      { timeout: 4000 },
    )
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
    const card = await openMatch(user, "Lena Ortiz · 2 people")
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
    const card = await openMatch(user, "Lena Ortiz · 2 people")
    expect(await within(card).findByText("number hidden: accounts keep only its fingerprint")).toBeInTheDocument()
    expect(card).not.toHaveTextContent(/\+\d/)
  })

  it("keeps two people apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockRejectedValue(new Error("identity.stale"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = await openMatch(user, "Lena Ortiz · 2 people")
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
    const card = await within(matches).findByRole(
      "article",
      { name: "Split off accounts of Viktor Example" },
      { timeout: 4000 },
    )
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
    expect(viktor).toHaveTextContent("Mila Example")
    expect(within(viktor).getByText("MAX")).toHaveClass("sr-only")
    await user.click(within(viktor).getByRole("button", { name: "Split" }))
    const dialog = await screen.findByRole("dialog", { name: "Move accounts to a new person" })
    await waitFor(() => expect(within(dialog).getByRole("checkbox", { name: /Mila Example/ })).toBeChecked())
  })

  it("names a doubt with no letter in its name after its accounts, and opens the person from the card", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    const card = within(panel)
      .getAllByRole("listitem")
      .find((row) => row.textContent?.startsWith("@msx04x")) as HTMLElement
    expect(card).toBeDefined()
    await user.click(within(card).getByRole("button", { name: "Open" }))
    expect(await screen.findByRole("dialog", { name: "@msx04x" })).toBeInTheDocument()
  })

  it("keeps the panel's Hide in its place and folds the help with the cards", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    const toggle = within(panel).getByRole("button", { name: "Hide" })
    const header = toggle.parentElement as HTMLElement
    expect(within(header).getByRole("heading", { name: /Check the links/ })).toBeInTheDocument()
    expect(header).not.toHaveTextContent(/We found people/)
    await user.click(toggle)
    expect(within(panel).getByRole("button", { name: "Show" })).toHaveAttribute("aria-expanded", "false")
  })

  it("confirms a doubtful link so it stops being listed, and says so", async () => {
    const keep = vi.spyOn(platform, "peopleKeep")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    const viktor = () =>
      within(panel)
        .queryAllByRole("listitem")
        .find((row) => row.textContent?.startsWith("Viktor Example"))
    await user.click(within(viktor() as HTMLElement).getByRole("button", { name: "These belong together" }))
    expect(keep).toHaveBeenCalledWith("person:40")
    expect(await within(panel).findByText(/Viktor Example will not come up here again/)).toBeInTheDocument()
    await waitFor(() => expect(viktor()).toBeUndefined())
  })

  it("says what to do when the tool cannot confirm a link yet", async () => {
    vi.spyOn(platform, "peopleKeep").mockRejectedValue(new Error("memo.too-old"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    await user.click(within(panel).getAllByRole("button", { name: "These belong together" })[0] as HTMLElement)
    expect(await within(panel).findByText(/If the Tools page offers no update yet/)).toBeInTheDocument()
  })

  it("shows three people who share a phone as one card, joins the two the owner ticks, then keeps the third apart", async () => {
    const merge = vi.spyOn(platform, "peopleMerge")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const title = "Konstantin Nikolaevich Loft Pro Max Semenov · Konstantin · K. Semenov"
    const card = await within(matches).findByRole("article", { name: title }, { timeout: 4000 })
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

  it("names the new person after the account the owner picks", async () => {
    const unlink = vi.spyOn(platform, "peopleUnlink").mockRejectedValue(new Error("held"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await openPerson(user, "Lena Ortiz")
    await user.click(await within(lena).findByRole("button", { name: "Move accounts to a new person" }))
    const dialog = screen.getByRole("dialog", { name: "Move accounts to a new person" })
    const boxes = within(dialog).getAllByRole("checkbox")
    await user.click(boxes[0] as HTMLElement)
    await user.click(boxes[2] as HTMLElement)
    const names = within(dialog).getByRole("group", { name: "Name of the new person" })
    expect(within(names).getByRole("radio", { name: "Lena" })).toBeChecked()
    await user.click(within(names).getByRole("radio", { name: "Lena O." }))
    await user.click(within(dialog).getByRole("button", { name: "Move 2 accounts" }))
    expect(unlink).toHaveBeenCalledWith("person:7", ["crm:acct/88", "telegram:4411"])
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
    expect(await screen.findByText("No one has nobody@example.org.")).toBeInTheDocument()
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
    expect(await screen.findByText(/There are more people than this page read/)).toBeInTheDocument()
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
    const card = await within(lena9).findByRole("article", { name: "Lena Ortiz · 2 people" })
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
    const card = await within(matches).findByRole(
      "article",
      { name: "Harbour Studio · Olga Harbour · Pavel Harbour" },
      { timeout: 4000 },
    )
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

    const contact = vi.spyOn(platform, "peopleContact")
    const users = within(card).getByRole("group", { name: "Who of them writes from this address?" })
    await user.click(within(users).getByRole("button", { name: "Save as the company's contacts" }))
    expect(within(users).getByText("Tick at least one person.")).toBeInTheDocument()
    expect(contact).not.toHaveBeenCalled()
    await user.click(within(users).getByRole("checkbox", { name: "Olga Harbour" }))
    await user.click(within(users).getByRole("button", { name: "Save as the company's contacts" }))
    expect(await within(card).findByText("Saved: Olga Harbour write for this company.")).toBeInTheDocument()
    expect(contact).toHaveBeenCalledWith("person:42", "organization:3")
  })

  it("hides a card of test data alone through memo, and brings a hidden person back as a real contact", async () => {
    const hide = vi.spyOn(platform, "peopleTestData")
    const keep = vi.spyOn(platform, "peopleKeep")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    const card = () =>
      within(panel)
        .queryAllByRole("listitem")
        .find((row) => row.textContent?.startsWith("Ann Lee"))
    expect(await within(card() as HTMLElement).findByText(/Hide it if it is/)).toBeInTheDocument()
    expect(await within(panel).findByText(/1 test account is hidden/, {}, { timeout: 4000 })).toBeInTheDocument()

    await user.click(within(card() as HTMLElement).getByRole("button", { name: "It is test data" }))
    expect(hide).toHaveBeenCalledWith("person:49")
    expect(await within(panel).findByText(/2 test accounts are hidden/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(card()).toBeUndefined()

    await user.click(within(panel).getByRole("button", { name: "Show" }))
    const hidden = within(panel)
      .getAllByRole("listitem")
      .find((row) => row.textContent?.startsWith("Ann Lee")) as HTMLElement
    await user.click(within(hidden).getByRole("button", { name: "It is a real contact" }))
    expect(keep).toHaveBeenCalledWith("person:49")
    expect(await within(panel).findByText(/Ann Lee is a real contact/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(within(panel).getByText(/1 test account is hidden/)).toBeInTheDocument()
  })

  it("separates the test accounts of a person who has real ones too", async () => {
    const unlink = vi.spyOn(platform, "peopleUnlink")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const panel = await screen.findByRole("region", { name: /Check the links/ }, { timeout: 4000 })
    const chen = within(panel)
      .getAllByRole("listitem")
      .find((row) => row.textContent?.startsWith("Chen Abad")) as HTMLElement
    await user.click(await within(chen).findByRole("button", { name: "Separate test accounts" }))
    expect(unlink).toHaveBeenCalledWith("person:102", ["email:chen.abad@example.org"])
    expect(await within(panel).findByText(/The test accounts left Chen Abad/)).toBeInTheDocument()
  })

  it("adds a person, asking once more when someone has the very same name", async () => {
    const add = vi.spyOn(platform, "peopleAdd")
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    const form = screen.getByRole("region", { name: "Add a person" })
    await user.click(within(form).getByRole("button", { name: "Add" }))
    expect(within(form).getByRole("alert")).toHaveTextContent("Type the person's name.")
    await user.type(within(form).getByRole("textbox"), "Lena Ortiz")
    expect(
      (await within(form).findAllByRole("button", { name: "Open Lena Ortiz" }, { timeout: 4000 }))[0],
    ).toBeVisible()
    expect(within(form).getAllByText("same name")[0]).toBeInTheDocument()
    await user.click(within(form).getByRole("button", { name: "Add" }))
    expect(within(form).getByRole("alert")).toHaveTextContent("Lena Ortiz is already in Contacts.")
    expect(add).not.toHaveBeenCalled()
    await user.click(within(form).getByRole("button", { name: "Add anyway" }))
    expect(add).toHaveBeenCalledWith("Lena Ortiz")
    expect(await within(form).findByRole("status", {}, { timeout: 4000 })).toHaveTextContent(
      "Added to Contacts: Lena Ortiz.",
    )
  })
})
