import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/shared/onboarding-store"
import { loadPages } from "@/testing/pages"
import { render, screen } from "@/testing/render"
import { App } from "./App"

beforeAll(loadPages)

describe("Clients", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("opens from the sidebar on the deals table", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Clients/ }))
    expect(await screen.findByRole("heading", { name: /^Clients/u, level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole("table", { name: "Deals" })).toBeInTheDocument()
  })
})
