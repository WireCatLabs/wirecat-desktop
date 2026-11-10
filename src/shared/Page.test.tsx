import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen } from "@/testing/render"
import { RefreshButton } from "@/ui/RefreshButton"
import { PageHeader } from "./Page"

it("opens the guide in the browser, not inside the app", async () => {
  const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
  render(
    <PageHeader
      title="Logs"
      intro="What each tool recorded."
      guide={{ label: "How to search", href: "https://x.dev/g" }}
    />,
  )
  expect(screen.getByRole("heading", { level: 1, name: "Logs" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("link", { name: "How to search" }))
  expect(open).toHaveBeenCalledWith("https://x.dev/g")
})

it("shows a spinner beside the title only while there is something to say", () => {
  const { rerender, container } = render(<PageHeader title="Tools" status={null} busy />)
  expect(container.querySelector(".animate-spin")).toBeNull()
  rerender(<PageHeader title="Tools" status="Checking…" busy />)
  expect(screen.getByText("Checking…")).toBeInTheDocument()
  expect(container.querySelector(".animate-spin")).not.toBeNull()
})

it("says it is busy and cannot be pressed twice while it runs", () => {
  render(<RefreshButton busy onClick={() => {}} label="Read again" busyLabel="Reading…" />)
  const button = screen.getByRole("button", { name: "Reading…" })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute("aria-busy", "true")
})
