import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { App } from "@/app/App"
import { sections } from "@/app/sections"
import { useOnboarding } from "@/shared/onboarding-store"
import { loadPages } from "@/testing/pages"
import { render, screen, within } from "@/testing/render"
import { BETA } from "./beta"

beforeAll(loadPages)

const LABEL = "Beta: this section is new and lightly tested"

describe("beta badge", () => {
  it("names only sections that exist, so a renamed section cannot lose its badge unnoticed", () => {
    for (const id of BETA) expect(sections.map((s) => s.id)).toContain(id)
  })

  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("marks the beta sections in the sidebar and on the page title, and no others", async () => {
    const user = userEvent.setup()
    render(<App />)
    const nav = screen.getByRole("navigation", { name: "Sections" })
    for (const name of ["Memory", "Contacts", "Clients", "Meetings"])
      expect(
        within(within(nav).getByRole("button", { name: new RegExp(name) })).getByRole("img", { name: LABEL }),
      ).toBeInTheDocument()
    for (const name of ["Search", "Tasks", "Digests", "Documents"])
      expect(
        within(within(nav).getByRole("button", { name: new RegExp(name) })).queryByRole("img", { name: LABEL }),
      ).toBeNull()

    await user.click(within(nav).getByRole("button", { name: /Memory/ }))
    const title = await screen.findByRole("heading", { level: 1, name: "Memory" })
    expect(within(title).queryByRole("img", { name: LABEL })).toBeNull()
    expect(within(title.parentElement as HTMLElement).getByRole("img", { name: LABEL })).toHaveAttribute("title", LABEL)
  })
})
