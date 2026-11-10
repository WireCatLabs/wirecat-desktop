import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, within } from "@/testing/render"
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
      expect(within(side).getByText("+7 912 555-01-47")).toHaveClass("ring-1")
      expect(within(side).getByText("matched")).toBeInTheDocument()
      expect(await within(side).findByText("Bitrix24 contact", {}, { timeout: 4000 })).toBeInTheDocument()
    }
    expect(within(sides[0] as HTMLElement).getByText("Northstar Logistics, Закупки")).toBeInTheDocument()
    expect(within(sides[0] as HTMLElement).getByText("Созвон по поставке")).toBeInTheDocument()
    for (const technical of ["person:", "bitrix24:", "northstar.example/contact", "17106", "initial", "Signal"])
      expect(dialog).not.toHaveTextContent(technical)
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
})
