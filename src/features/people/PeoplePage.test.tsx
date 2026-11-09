import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { PeoplePage } from "./PeoplePage"
import { usePeople } from "./store"

// The mock store outlives each test, so these tests spy where a later one must not see an earlier decision.
const list = () => screen.findByRole("region", { name: "People" }, { timeout: 4000 })
const open = async (user: ReturnType<typeof userEvent.setup>, ref: string) => {
  const row = (await list()).querySelector(`[data-person="${ref}"]`) as HTMLElement
  await user.click(within(row).getByRole("button", { expanded: false }))
  return row
}

describe("People", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePeople.setState(usePeople.getInitialState(), true)
  })

  it("lists everyone, the owner as You, and shows a person's accounts by source with their scope", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    const region = await list()
    expect(within(region).getByText("You")).toBeInTheDocument()
    const lena = await open(user, "person:7")
    const email = await within(lena).findByRole("region", { name: "email" })
    expect(within(email).getByText("work")).toBeInTheDocument()
    expect(within(email).getByText("personal")).toBeInTheDocument()
    expect(within(email).getByText(/joined by the same email address/)).toBeInTheDocument()
    expect(within(lena).getByRole("button", { name: "Undo…" })).toBeInTheDocument()
  })

  it("confirms a waiting match as the owner, and the card stays and says so", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockImplementation((ref) => platform.peopleShow(ref))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const waiting = await screen.findByRole("heading", { name: /2 matches wait for you/ }, { timeout: 4000 })
    const card = within(waiting.closest("section") as HTMLElement).getByRole("article", { name: /Join/ })
    expect(card).toHaveTextContent("Found by WireCat's matching")
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(decide).toHaveBeenCalledWith("person:9", "17100", "confirm", undefined)
    expect(await within(card).findByRole("status")).toHaveTextContent("Joined into one person.")
  })

  it("keeps two people apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockRejectedValue(new Error("identity.stale"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const waiting = await screen.findByRole("heading", { name: /wait for you/ }, { timeout: 4000 })
    const card = within(waiting.closest("section") as HTMLElement).getByRole("article", { name: /Join/ })
    await user.click(within(card).getByRole("button", { name: "Not the same…" }))
    const why = within(card).getByRole("textbox", { name: "Why are they different people?" })
    expect(why).toHaveFocus()
    expect(within(card).getByRole("button", { name: "Keep them apart" })).toBeDisabled()
    await user.type(why, "two colleagues{Enter}")
    expect(decide).toHaveBeenCalledWith("person:9", "17100", "reject", "two colleagues")
    expect(await within(card).findByText(/changed since WireCat suggested this/)).toBeInTheDocument()
  })

  it("moves ticked accounts to a new person, never all of them, with nothing ticked at first", async () => {
    const unlink = vi.spyOn(platform, "peopleUnlink")
    const user = userEvent.setup()
    render(<PeoplePage />)
    const lena = await open(user, "person:7")
    await user.click(await within(lena).findByRole("button", { name: "Move accounts to a new person…" }))
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
    const lena = await open(user, "person:7")
    await user.click(await within(lena).findByRole("button", { name: "Undo…" }))
    const dialog = screen.getByRole("dialog", { name: "Undo this join?" })
    expect(dialog).toHaveTextContent("email:lena@example.org")
    await user.click(within(dialog).getByRole("button", { name: "Undo the join" }))
    expect(unmerge).toHaveBeenCalledWith("person:7", "merge:7-12")
  })

  it("says when one account would move rather than two people join, and who suggested it", async () => {
    render(<PeoplePage />)
    const card = await screen.findByRole("article", { name: "Move max:7731 to Kai Moreno?" }, { timeout: 4000 })
    expect(card).toHaveTextContent("Only this account moves.")
    expect(card).toHaveTextContent("Suggested by claude-code")
  })

  it("finds a person by an account they have, and opens them", async () => {
    const user = userEvent.setup()
    render(<PeoplePage />)
    await list()
    await user.type(screen.getByRole("searchbox", { name: "Find a person" }), "telegram:5120{Enter}")
    expect(await screen.findByText("telegram:5120 belongs to Kai Moreno.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open Kai Moreno" }))
    const kai = (await list()).querySelector('[data-person="person:4"]') as HTMLElement
    expect(within(kai).getByRole("button", { expanded: true })).toBeInTheDocument()
    await user.clear(screen.getByRole("searchbox", { name: "Find a person" }))
    await user.type(screen.getByRole("searchbox", { name: "Find a person" }), "nobody@example.org{Enter}")
    expect(await screen.findByText("No one in Memo has nobody@example.org.")).toBeInTheDocument()
  })

  it("says when memo has more people and matches than the page read", async () => {
    vi.spyOn(platform, "peopleRead").mockResolvedValue({
      kind: "ready",
      people: [{ ref: "person:1", name: null, owner: true }],
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
    const lena9 = await open(user, "person:9")
    const card = await within(lena9).findByRole("article", { name: /Join/ })
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(await within(lena9).findByText("This person is now part of Lena Ortiz.")).toBeInTheDocument()
  })
})
