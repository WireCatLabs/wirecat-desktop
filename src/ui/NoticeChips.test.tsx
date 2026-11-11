import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"
import { render, screen } from "@/testing/render"
import { type Notice, NoticeChips } from "./NoticeChips"

const stages: Notice = { id: "stages", tone: "warn", label: "3 stages to confirm", body: <p>Confirm them</p> }
const crm: Notice = { id: "crm", tone: "neutral", label: "Bitrix24 not installed", body: <p>Install it</p> }

it("opens one notice at a time, and one that left stays closed when it comes back", async () => {
  const user = userEvent.setup()
  const { rerender } = render(<NoticeChips label="Notices" notices={[crm, stages]} />)
  expect(screen.queryByText("Confirm them")).toBeNull()
  await user.click(screen.getByRole("button", { name: "3 stages to confirm" }))
  expect(screen.getByText("Confirm them")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Bitrix24 not installed" }))
  expect(screen.getByRole("button", { name: "Bitrix24 not installed", expanded: true })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "3 stages to confirm", expanded: false })).toBeInTheDocument()

  rerender(<NoticeChips label="Notices" notices={[stages]} />)
  rerender(<NoticeChips label="Notices" notices={[crm, stages]} />)
  expect(screen.getByRole("button", { name: "Bitrix24 not installed", expanded: false })).toBeInTheDocument()
})
