import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"

const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })
const row = (text: RegExp) => screen.getByRole("button", { name: text }).closest("[data-row]") as HTMLElement

it("shows an agent's relationship waiting under the person, with its role and standing, and approves it", async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(platform, "memoryConfirm")
  render(<MemoryPage />)
  await rack()
  const proposal = row(/Northstar Consulting · Decision-maker/)
  expect(within(proposal).getByText("Proposed")).toBeInTheDocument()
  expect(within(proposal).getByText("Member of")).toBeInTheDocument()
  await user.click(within(proposal).getByRole("button", { name: "Approve" }))
  expect(confirm).toHaveBeenCalledWith("relationship:5", undefined)
  await waitFor(() => expect(within(proposal).getByText("Confirmed")).toBeInTheDocument())
})

it("lists what holds with its standing, the owner's own role by its label, and no decision to make", async () => {
  const user = userEvent.setup()
  render(<MemoryPage />)
  await rack()
  await user.click(screen.getByRole("radio", { name: /In use/ }))
  const owners = row(/Harbour Studio · Board member/)
  expect(within(owners).getByText("Confirmed")).toBeInTheDocument()
  expect(within(owners).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
  const crm = row(/Your company/)
  expect(within(crm).getByText("Reported")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: /Your company/ }))
  expect(await screen.findByText("bitrix24:acme.example")).toBeInTheDocument()
})
