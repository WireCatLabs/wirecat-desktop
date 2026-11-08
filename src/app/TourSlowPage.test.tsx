import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useTour } from "@/features/onboarding/Tour"
import { useOnboarding } from "@/shared/onboarding-store"
import { hideRowSync } from "@/testing/onboarding"
import { render, screen, within } from "@/testing/render"
import { App } from "./App"

// Longer than both the 30 frames a stop waits and the 3 s the wait once was.
const LOAD_MS = 4000

vi.mock("@/features/search/page", async (original) => {
  await new Promise((done) => setTimeout(done, LOAD_MS))
  return original()
})

beforeEach(() => {
  localStorage.clear()
  useOnboarding.setState({ status: "done", open: false })
  hideRowSync()
})
afterEach(() => useTour.getState().close())

it("keeps a stop whose page takes longer to load than a stop waits", async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole("list", { name: "WireCat tools" })
  await user.click(screen.getByRole("button", { name: "Help" }))
  await user.click(screen.getByRole("menuitem", { name: "Take the tour" }))
  await screen.findByRole("dialog", { name: "Tools" })
  for (const title of ["Status lamps", "One action per tool", "Agents", "How it works with your agent", "Search"]) {
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Next" }))
    await screen.findByRole("dialog", { name: title })
  }
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Next" }))
  expect(
    await screen.findByRole("dialog", { name: "Ask in your own words" }, { timeout: LOAD_MS + 3000 }),
  ).toBeVisible()
}, 20000)
