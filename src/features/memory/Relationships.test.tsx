import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"

const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })
const row = (text: RegExp) => screen.getByRole("button", { name: text }).closest("[data-row]") as HTMLElement

it("shows an agent's relationship waiting under the person, with its role, no state word in its own tab, and approves it", async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(platform, "memoryConfirm")
  render(<MemoryPage />)
  await rack()
  const proposal = row(/Kai Moreno is the decision-maker of the organization “Northstar Consulting”/)
  expect(within(proposal).queryByText("Waiting for you")).not.toBeInTheDocument()
  expect(within(proposal).getByText("Link")).toBeInTheDocument()
  await user.click(within(proposal).getByRole("button", { name: "Approve" }))
  expect(confirm).toHaveBeenCalledWith("relationship:5", undefined)
  await waitFor(() => expect(within(proposal).getByText("In use")).toBeInTheDocument())
})

it("lists what holds with its standing, the owner's own role by its label, and no decision to make", async () => {
  const user = userEvent.setup()
  render(<MemoryPage />)
  await rack()
  await user.click(screen.getByRole("radio", { name: /In use/ }))
  const owners = row(/Kai Moreno is the board member of the organization “Harbour Studio”/)
  expect(within(owners).queryByText("In use")).not.toBeInTheDocument()
  expect(within(owners).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
  const crm = row(/Northstar Consulting” is a customer of “Your company”/)
  expect(within(crm).getByText("Reported")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: /Your company/ }))
  expect(await screen.findByText("bitrix24:acme.example")).toBeInTheDocument()
})

it("says what approving changes, shows the document it came from, and edits the role before approving", async () => {
  const user = userEvent.setup()
  const edit = vi.spyOn(platform, "memoryRelationEdit")
  render(<MemoryPage />)
  await rack()
  await user.click(screen.getByRole("button", { name: /Harry is the owner/ }))
  expect(screen.getByText("If you approve")).toBeInTheDocument()
  expect(screen.getByText("Where it came from")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Show Sales motivation model in context/ })).toBeInTheDocument()
  await user.click(screen.getAllByRole("button", { name: "Edit" }).at(-1) as HTMLElement)
  const role = screen.getByRole("textbox", { name: "Role, in your words" })
  await user.clear(role)
  await user.type(role, "reviewer")
  await user.click(screen.getByRole("button", { name: "Save and approve" }))
  expect(edit).toHaveBeenCalledWith("relationship:23", "reviewer")
  const harry = await screen.findByRole("button", { name: /Harry is the reviewer of the document/ })
  expect(within(harry.closest("[data-row]") as HTMLElement).getByText("In use")).toBeInTheDocument()
})

it("reads a source's owner links as sentences with clean names, and rejects what still waits in the group in one call", async () => {
  const user = userEvent.setup()
  const decide = vi.spyOn(platform, "memoryRelationsDecide")
  render(<MemoryPage />)
  await rack()
  expect(screen.queryByText(/null #/)).not.toBeInTheDocument()
  const yaro = row(/Yaro Orlov is the owner of the document “Sales motivation model”/)
  expect(within(yaro).queryByText("Waiting for you")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Reject all 2" }))
  expect(decide).toHaveBeenCalledTimes(1)
  expect(decide).toHaveBeenCalledWith(["relationship:21", "relationship:22"], false)
  expect(await screen.findByText("2 rejected")).toBeInTheDocument()
  expect(within(yaro).getByText("Rejected")).toBeInTheDocument()
})
