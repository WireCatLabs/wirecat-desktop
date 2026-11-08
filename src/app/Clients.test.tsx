import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, screen } from "@/testing/render"
import { App } from "./App"

describe("Clients", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("opens from the sidebar on the deals board", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Clients/ }))
    expect(await screen.findByRole("heading", { name: "Clients", level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole("region", { name: /^Quote, 1 card/ }, { timeout: 4000 })).toBeInTheDocument()
  }, 15000)
})
