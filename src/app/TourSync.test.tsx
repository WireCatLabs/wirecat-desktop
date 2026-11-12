import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useTour } from "@/features/onboarding/Tour"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, screen, within } from "@/testing/render"
import { App } from "./App"

// Its own file: the sync store reads each row's profiles once per module, so another test's reads would hide the button.
beforeEach(() => {
  localStorage.clear()
  useOnboarding.setState({ status: "done", open: false })
})
afterEach(() => {
  useTour.getState().close()
  vi.restoreAllMocks()
})

it("points at a row's sync button when a tool can sync from its row", async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findAllByRole("button", { name: /^Sync .+ now$/ })
  await user.click(screen.getByRole("button", { name: "Help" }))
  await user.click(screen.getByRole("menuitem", { name: "Take the tour" }))
  for (const title of ["Tools", "Status lamps", "One action per tool", "Sync", "Agents"]) {
    const dialog = await screen.findByRole("dialog", { name: title })
    await user.click(within(dialog).getByRole("button", { name: "Next" }))
  }
  expect(await screen.findByRole("dialog", { name: "How it works with your agent" })).toBeInTheDocument()
})
