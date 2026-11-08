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
  beforeEach(() => usePeople.setState(usePeople.getInitialState(), true))

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
    const waiting = await screen.findByRole("heading", { name: /1 match waits for you/ }, { timeout: 4000 })
    const card = within(waiting.closest("section") as HTMLElement).getByRole("article")
    await user.click(within(card).getByRole("button", { name: "Same person" }))
    expect(decide).toHaveBeenCalledWith("person:7", "17100", "confirm", undefined)
    expect(await within(card).findByRole("status")).toHaveTextContent("Joined into one person.")
  })

  it("keeps two people apart only with the owner's reason", async () => {
    const decide = vi.spyOn(platform, "peopleDecide").mockRejectedValue(new Error("identity.stale"))
    const user = userEvent.setup()
    render(<PeoplePage />)
    const waiting = await screen.findByRole("heading", { name: /waits for you/ }, { timeout: 4000 })
    const card = within(waiting.closest("section") as HTMLElement).getByRole("article")
    await user.click(within(card).getByRole("button", { name: "Not the same…" }))
    const why = within(card).getByRole("textbox", { name: "Why are they different people?" })
    expect(why).toHaveFocus()
    expect(within(card).getByRole("button", { name: "Keep them apart" })).toBeDisabled()
    await user.type(why, "two colleagues{Enter}")
    expect(decide).toHaveBeenCalledWith("person:7", "17100", "reject", "two colleagues")
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

  it("offers memo's update when it is too old", async () => {
    vi.spyOn(platform, "peopleRead").mockResolvedValue({ kind: "old", version: "0.131.63", need: "0.132.0" })
    render(<PeoplePage />)
    expect(await screen.findByText(/needs Memo 0.132.0 or newer/)).toBeInTheDocument()
  })
})
