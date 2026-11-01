import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { matcher, parseQuery, type Run } from "@/domain/runs"
import { useLogs } from "../logs/store"
import { MEMORY_RUNS } from "./Activity"
import { MemoryPage } from "./MemoryPage"
import { useMemory } from "./store"

beforeEach(() => useMemory.setState(useMemory.getInitialState(), true))

// The mock store outlives each test, so a later test reads what an earlier one approved or rejected.
const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })
const row = (text: RegExp) => screen.getByRole("button", { name: text }).closest("[data-row]") as HTMLElement
const all = async (user: ReturnType<typeof userEvent.setup>) => {
  await rack()
  await user.click(screen.getByRole("radio", { name: /All/ }))
}

describe("Memory", () => {
  it("approves a waiting row without opening it, and the row turns green where it is", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    expect(screen.getByRole("radio", { name: /Review/ })).toBeChecked()
    const kai = row(/Kai Sample prefers calls on Friday/)
    expect(within(kai).getByRole("button", { name: "Reject" })).toBeInTheDocument()
    await user.click(within(kai).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(within(kai).getByRole("img", { name: "In use" })).toBeInTheDocument())
    expect(row(/Kai Sample prefers calls on Friday/)).toBe(kai)

    await user.click(screen.getByRole("radio", { name: /In use/ }))
    await user.click(screen.getByRole("radio", { name: /Review/ }))
    expect(screen.queryByRole("button", { name: /Kai Sample prefers calls on Friday/ })).not.toBeInTheDocument()
  })

  it("groups rows under the project or person they are about", async () => {
    render(<MemoryPage />)
    const region = await rack()
    const headings = within(region)
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent)
    expect(headings[0]).toMatch(/^Northbridge Bench/)
    expect(headings).toEqual(expect.arrayContaining([expect.stringMatching(/^Project Harbour/)]))
  })

  it("erases from the row's menu, by keyboard, after a dialog that lists what goes", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    const ana = row(/Ana Ruiz is moving to Valencia/)
    within(ana).getByRole("button", { name: "More actions" }).focus()
    await user.keyboard("{ArrowDown}")
    const menu = screen.getByRole("menu", { name: "More actions" })
    expect(within(menu).getAllByRole("menuitem")[0]).toHaveFocus()
    await user.keyboard("{End}{Enter}")

    const dialog = screen.getByRole("dialog", { name: "Erase this memory?" })
    expect(dialog).toHaveTextContent("memory:40")
    expect(within(dialog).getByRole("button", { name: "Reject instead" })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Erase" }))
    await waitFor(() => expect(screen.queryByRole("button", { name: /Ana Ruiz is moving/ })).not.toBeInTheDocument(), {
      timeout: 3000,
    })
  })

  it("corrects the text where it stands, and Escape puts it back", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("button", { name: /Harbour launch moves/ }))
    await user.click(screen.getByText(/Harbour launch moves/))
    expect(screen.getByRole("textbox", { name: "What is true instead" })).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("writes a correction from the row's main action and keeps the old one as replaced", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("radio", { name: /In use/ }))
    const mine = row(/You want reminders in the morning/)
    await user.click(within(mine).getByRole("button", { name: "Correct" }))
    const box = screen.getByRole("textbox", { name: "What is true instead" })
    await user.clear(box)
    await user.type(box, "You want reminders before 10:00.")
    await user.click(screen.getByRole("button", { name: "Save correction" }))
    expect(await screen.findByRole("button", { name: /You want reminders before 10:00/ })).toBeInTheDocument()
    expect(within(row(/You want reminders in the morning/)).getByRole("img", { name: "Replaced" })).toBeInTheDocument()
  })

  it("filters by a value clicked in the details, and by kind typed", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await all(user)
    await user.click(screen.getByRole("button", { name: /Harbour launch moves/ }))
    await user.click(screen.getByRole("button", { name: "Show only Decision" }))
    expect(screen.getByRole("combobox", { name: "Kind" })).toHaveValue("Decision")
    const texts = within(await rack())
      .getAllByRole("button", { name: /moves|Scores/ })
      .map((b) => b.textContent)
    expect(texts.every((t) => /Decision/.test(t ?? ""))).toBe(true)
    expect(screen.queryByRole("button", { name: /Kai Sample prefers/ })).not.toBeInTheDocument()
  })

  it("opens a cited message among its neighbours in place", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await all(user)
    await user.click(screen.getByRole("button", { name: /Kai Sample prefers calls on Friday/ }))
    const [first] = await screen.findAllByRole("button", { name: "Show Kai Sample in context" }, { timeout: 3000 })
    await user.click(first as HTMLElement)
    expect(await screen.findByText("Deal. I'll send them Thursday evening.")).toBeInTheDocument()
  })

  it("shows an agent's findings and creates only the ticked ones", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("button", { name: /2 facts and 2 tasks to review/ }))
    expect(screen.getByText("What Approve creates in Northbridge Bench")).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /Ask Tom Becker for read access/ }))
    expect(screen.getByText(/creates the 3 ticked ones in Northbridge Bench/)).toBeInTheDocument()

    const batch = row(/2 facts and 2 tasks to review/)
    await user.click(within(batch).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(within(batch).getAllByText(/^Created/)).toHaveLength(3), { timeout: 3000 })
    expect(within(batch).getByText(/^Rejected/)).toBeInTheDocument()
  })

  it("sends All activity to Logs filtered to memo's memory runs", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await user.click(await screen.findByRole("button", { name: "All activity in Logs" }, { timeout: 4000 }))
    expect(useLogs.getState().query).toBe(MEMORY_RUNS)
    const match = matcher(parseQuery(MEMORY_RUNS).terms)
    const run = (tool: string, command: string) => ({ tool, command, run_id: "1", status: "ok", started_at: "" }) as Run
    expect(match(run("memo", "memories add"))).toBe(true)
    expect(match(run("memo", "projects actions confirm"))).toBe(true)
    expect(match(run("memo", "search all"))).toBe(false)
    expect(match(run("tg", "facts list"))).toBe(false)
  })
})
