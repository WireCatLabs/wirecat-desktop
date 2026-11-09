import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { PeoplePage } from "./PeoplePage"
import { usePeople } from "./store"

// The mock store outlives each test, so these tests spy where a later one must not see an earlier decision.
type User = ReturnType<typeof userEvent.setup>
const table = () => screen.findByRole("table", { name: "People" }, { timeout: 4000 })
const openPerson = async (user: User, name: string) => {
  await user.click(within(await table()).getAllByRole("button", { name })[0] as HTMLElement)
  return screen.findByRole("dialog", { name })
}
const openMatches = async (user: User) => {
  await user.click(await screen.findByRole("button", { name: "Review matches" }, { timeout: 4000 }))
  return screen.findByRole("region", { name: "Possible duplicates" })
}

describe("People", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePeople.setState(usePeople.getInitialState(), true)
  })

  it("lists people in a table with clean names, their sources and tasks, a page at a time", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const rows = await table()
    expect(within(rows).getByRole("button", { name: /You/ })).toBeInTheDocument()
    expect(within(rows).getByRole("button", { name: "CZECH AIRLINES" })).toBeInTheDocument()
    expect(await within(rows).findByRole("button", { name: "@ivan_petrov" }, { timeout: 4000 })).toBeInTheDocument()
    const lena = within(rows)
      .getAllByRole("row")
      .find((r) => r.textContent?.startsWith("Lena Ortiz")) as HTMLElement
    expect(await within(lena).findByText("3 accounts", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(within(lena).getByText("Telegram")).toBeInTheDocument()
    expect(within(lena).getByText("3")).toBeInTheDocument()
    const pages = screen.getByRole("navigation", { name: "Pages" })
    expect(pages).toHaveTextContent("1–50 of 122")
    expect(within(pages).getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page")
    await user.click(within(pages).getByRole("button", { name: "Page 2" }))
    expect(pages).toHaveTextContent("51–100 of 122")
    expect(within(await table()).queryByRole("button", { name: "CZECH AIRLINES" })).not.toBeInTheDocument()
  })

  it("narrows the table to people with tasks", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    await user.click(screen.getByRole("button", { name: "With tasks" }))
    expect(screen.getByText("4 people")).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument()
  })

  it("opens a person in a dialog with their accounts by source and scope", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await openPerson(user, "Lena Ortiz")
    const email = await within(lena).findByRole("region", { name: "Email" })
    expect(within(email).getByText("work")).toBeInTheDocument()
    expect(within(email).getByText("personal")).toBeInTheDocument()
    expect(within(email).getByText(/joined by the same email address/)).toBeInTheDocument()
    expect(within(lena).getByRole("button", { name: "Undo" })).toBeInTheDocument()
  })

  it("says how many matches wait, and opens them on their own screen and back", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    expect(await screen.findByRole("heading", { name: "4 matches wait for you" }, { timeout: 4000 })).toBeVisible()
    const matches = await openMatches(user)
    expect(matches).toHaveTextContent("all their chats, mail, meetings and deals")
    expect(within(matches).getAllByRole("article")).toHaveLength(4)
    await user.click(screen.getByRole("button", { name: "All people" }))
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
    expect(within(card).getByRole("button", { name: "same" })).toHaveAccessibleDescription(
      "They have the same email address. Seen as marta@studio.example",
    )
    expect(card).not.toHaveTextContent("northstar.example")
    expect(card).not.toHaveTextContent("person:22")
    await user.click(within(card).getByRole("button", { name: "Marta Gil (Studio) · Marta Gil" }))
    const details = await screen.findByRole("dialog", { name: "Match details" })
    expect(details).toHaveTextContent("bitrix24:https://northstar.example/crm/contact/details/4120/")
  })

  it("confirms a waiting match as the owner, and the card stays and says so", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = within(await openMatches(user)).getByRole("article", { name: "Lena Ortiz · Lena Ortiz" })
    expect(within(card).getByRole("button", { name: "WireCat" })).toHaveAccessibleDescription(/found this itself/)
    const buttons = within(card)
      .getAllByRole("button")
      .map((b) => b.textContent)
    expect(buttons.slice(-3)).toEqual(["Details", "Same person", "Not the same"])
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(decide).toHaveBeenCalledWith("person:9", "17100", "confirm", undefined)
    expect(await within(card).findByText("Joined into one person.")).toBeInTheDocument()
  })

  it("keeps two people apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockRejectedValue(new Error("identity.stale"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const card = within(await openMatches(user)).getByRole("article", { name: "Lena Ortiz · Lena Ortiz" })
    await user.click(within(card).getByRole("button", { name: "Not the same" }))
    const why = within(card).getByRole("textbox", { name: "Why are they different people?" })
    expect(why).toHaveFocus()
    expect(within(card).getByRole("button", { name: "Keep them apart" })).toBeDisabled()
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

  it("shows three people who share a phone as one card, joins the two the owner ticks, then the third", async () => {
    const merge = vi.spyOn(platform, "peopleMerge")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const matches = await openMatches(user)
    const title = "Konstantin Nikolaevich Loft Pro Max Semenov · Konstantin · K. Semenov"
    const card = within(matches).getByRole("article", { name: title })
    expect(within(card).getByRole("button", { name: "3" })).toHaveAccessibleDescription(
      "3 people have it. Here now: Konstantin Nikolaevich Loft Pro Max Semenov, Konstantin, and K. Semenov.",
    )
    await user.click(within(card).getByRole("button", { name: title }))
    const details = await screen.findByRole("dialog", { name: "Match details" })
    expect(within(details).getAllByRole("region")).toHaveLength(3)
    await user.click(within(details).getByRole("button", { name: "Close" }))

    const boxes = within(card).getAllByRole("checkbox")
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true, true])
    await user.click(within(card).getByRole("checkbox", { name: "K. Semenov is one of them" }))
    await user.click(within(card).getByRole("button", { name: "Join 2" }))
    expect(merge).toHaveBeenCalledWith(["person:30", "person:31"])
    expect(
      await within(card).findByText(/Konstantin Nikolaevich Loft Pro Max Semenov and Konstantin are now one person/),
    ).toBeInTheDocument()
    await waitFor(() => expect(within(card).queryAllByRole("checkbox")).toHaveLength(0))
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(await within(card).findByText("Joined into one person.", {}, { timeout: 4000 })).toBeInTheDocument()
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
    expect(within(dialog).getByRole("button", { name: "Move 3 accounts" })).toBeDisabled()
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
    await user.click(await within(lena).findByRole("button", { name: "Undo" }))
    const dialog = screen.getByRole("dialog", { name: "Undo this join?" })
    expect(dialog).toHaveTextContent("email:lena@example.org")
    await user.click(within(dialog).getByRole("button", { name: "Undo the join" }))
    expect(unmerge).toHaveBeenCalledWith("person:7", "merge:7-12")
  })

  it("finds a person by an account they have, and opens them", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    await user.type(screen.getByRole("searchbox", { name: "Find a person" }), "telegram:5120{Enter}")
    expect(await screen.findByText("telegram:5120 belongs to Kai Moreno.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open Kai Moreno" }))
    expect(await screen.findByRole("dialog", { name: "Kai Moreno" })).toBeInTheDocument()
  })

  it("says when an account belongs to no one", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await table()
    await user.type(screen.getByRole("searchbox", { name: "Find a person" }), "nobody@example.org{Enter}")
    expect(await screen.findByText("No one in Memo has nobody@example.org.")).toBeInTheDocument()
  })

  it("says when memo has more people and matches than the page read", async () => {
    vi.spyOn(platform, "peopleRead").mockResolvedValue({
      kind: "ready",
      people: [{ ref: "person:1", name: null, owner: true, tasks: 0 }],
      peopleMore: true,
      matches: [],
      matchesMore: false,
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
})
