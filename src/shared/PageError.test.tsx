import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { render, screen } from "@/testing/render"
import { PageError } from "./PageError"
import { useReport } from "./report-store"

it("says what failed, folds the tool's text under Details, retries and reports", async () => {
  const user = userEvent.setup()
  const retry = vi.fn()
  render(
    <PageError raw="spawn memo ENOENT" what="Reading memory" onRetry={retry}>
      Could not read memory.
    </PageError>,
  )
  const alert = screen.getByRole("alert")
  expect(alert).toHaveTextContent(/^Could not read memory\./)
  expect(screen.queryByText("spawn memo ENOENT")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Details" }))
  expect(await screen.findByText("spawn memo ENOENT")).toBeVisible()

  await user.click(screen.getByRole("button", { name: "Try again" }))
  expect(retry).toHaveBeenCalledOnce()
  await user.click(screen.getByRole("button", { name: "Report this" }))
  expect(useReport.getState().open).toBe(true)
})
