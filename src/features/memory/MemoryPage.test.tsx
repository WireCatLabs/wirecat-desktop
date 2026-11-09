import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { matcher, parseQuery, type Run } from "@/domain/runs"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { render, screen, waitFor, within } from "@/testing/render"
import { useLogs } from "../logs/store"
import { useTasks } from "../tasks/store"
import { MEMORY_RUNS } from "./Activity"
import { MemoryPage } from "./MemoryPage"
import { useMemory } from "./store"

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
    const kai = row(/Kai Moreno prefers calls on Friday/)
    expect(within(kai).getByRole("button", { name: "Reject" })).toBeInTheDocument()
    await user.click(within(kai).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(within(kai).getByRole("img", { name: "In use" })).toBeInTheDocument())
    expect(row(/Kai Moreno prefers calls on Friday/)).toBe(kai)

    await user.click(screen.getByRole("radio", { name: /In use/ }))
    await user.click(screen.getByRole("radio", { name: /Review/ }))
    expect(screen.queryByRole("button", { name: /Kai Moreno prefers calls on Friday/ })).not.toBeInTheDocument()
  })

  it("pages a long list, and the subject's count stays the count of all its rows", async () => {
    const user = userEvent.setup()
    const read = await platform.memoryRead()
    if (read.kind !== "ready") throw new Error("the mock memory is not ready")
    const one = read.entries.find((e) => e.type === "fact" && e.status === "proposed") ?? read.entries[0]
    if (!one) throw new Error("the mock memory has no entries")
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...one,
      ref: `fact:${9000 + i}`,
      text: `Long list fact ${i}`,
    }))
    vi.spyOn(platform, "memoryRead").mockResolvedValueOnce({ ...read, entries: many })
    useMemory.setState(useMemory.getInitialState(), true)
    render(<MemoryPage />)
    const region = await rack()
    expect(within(region).getAllByText(/^Long list fact/)).toHaveLength(50)
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(/60/)
    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(within(await rack()).getAllByText(/^Long list fact/)).toHaveLength(10)
    expect(screen.getByText("Long list fact 59")).toBeInTheDocument()
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
    await user.click(within(mine).getByRole("button", { name: "Edit" }))
    const box = screen.getByRole("textbox", { name: "What is true instead" })
    await user.clear(box)
    await user.type(box, "You want reminders before 10:00.")
    await user.click(screen.getByRole("button", { name: "Save correction" }))
    expect(await screen.findByRole("button", { name: /You want reminders before 10:00/ })).toBeInTheDocument()
    expect(within(row(/You want reminders in the morning/)).getByRole("img", { name: "Replaced" })).toBeInTheDocument()
  })

  it("filters by a value clicked in the details, and the chip and the search say the same", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await all(user)
    await user.click(screen.getByRole("button", { name: /Harbour launch moves/ }))
    await user.click(screen.getByRole("button", { name: "Show only Decision" }))
    const search = screen.getByRole("searchbox", { name: "Search memory" })
    expect(search).toHaveValue("kind:decision")
    expect(screen.getByRole("button", { name: "Kind: Decision" })).toBeInTheDocument()
    const texts = within(await rack())
      .getAllByRole("button", { name: /moves|Scores/ })
      .map((b) => b.textContent)
    expect(texts.every((t) => /Decision/.test(t ?? ""))).toBe(true)
    expect(screen.queryByRole("button", { name: /Kai Moreno prefers/ })).not.toBeInTheDocument()

    await user.type(search, " pilot")
    expect(within(await rack()).getAllByRole("button", { name: /Harbour launch moves/ })).not.toHaveLength(0)
    expect(screen.queryByRole("button", { name: /Scores below/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear kind" }))
    expect(search).toHaveValue("pilot")
  })

  it("opens a cited message among its neighbours in place", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await all(user)
    await user.click(screen.getByRole("button", { name: /Kai Moreno prefers calls on Friday/ }))
    const [first] = await screen.findAllByRole("button", { name: "Show Kai Moreno in context" }, { timeout: 3000 })
    await user.click(first as HTMLElement)
    expect(await screen.findByText("Deal. I'll send them Thursday evening.")).toBeInTheDocument()
  })

  it("approves only the findings on screen and ticked, with their count on the button; the rest stay unapproved", async () => {
    const confirm = vi.spyOn(platform, "memoryConfirm")
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    const batch = row(/2 facts and 2 tasks to review/)
    await user.click(within(batch).getByRole("button", { name: "Review 4" }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByText("What Approve creates in Northbridge Bench")).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /Ask Tom Becker for read access/ }))
    expect(screen.getByText(/creates the 3 ticked ones in Northbridge Bench/)).toBeInTheDocument()
    await user.click(within(batch).getByRole("button", { name: "Approve 3" }))
    await waitFor(() => expect(within(batch).getAllByText(/^Created/)).toHaveLength(3), { timeout: 3000 })
    const [, accept] = confirm.mock.calls[0] ?? []
    expect(accept).toHaveLength(3)
    expect(within(batch).getByText(/^Rejected/)).toBeInTheDocument()
    confirm.mockRestore()
  })

  it("opens the task an approved action became, on the Tasks page", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await all(user)
    const approved = row(/Make a task for Kai Moreno: Send Kai the pricing table/)
    await user.click(within(approved).getByRole("button", { name: "Open the task" }))
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"))
    expect(useTasks.getState().open).toBe("HRB-12")
  })

  it("lists what an approved findings batch created, each one a click away", async () => {
    const user = userEvent.setup()
    useNav.setState({ active: "memory" })
    render(<MemoryPage />)
    await all(user)
    const batch = row(/Findings: 2 created, 1 rejected/)
    await user.click(within(batch).getByRole("button", { name: "What it created" }))
    expect(within(batch).getByRole("button", { name: "What it created" })).toHaveAttribute("aria-expanded", "true")
    await user.click(within(batch).getByRole("button", { name: /Open the fact/ }))
    expect(useMemory.getState().open).toBe("fact:22")
    expect(useMemory.getState().tab).toBe("all")
    const fact = row(/Both pilot clinics sign the data agreement/)
    await waitFor(() => expect(within(fact).getByRole("button", { name: /Both pilot clinics sign/ })).toHaveFocus())

    await user.click(within(row(/Findings: 2 created/)).getByRole("button", { name: /What it created/ }))
    await user.click(within(row(/Findings: 2 created/)).getByRole("button", { name: /Open the task/ }))
    await waitFor(() => expect(useTasks.getState().open).toBe("HRB-14"))
  })

  it("takes back an approval where memo can: a memory stops holding, a decision is undone", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("radio", { name: /In use/ }))
    const digest = row(/Project Harbour this week/)
    await user.click(within(digest).getByRole("button", { name: "More actions" }))
    await user.click(screen.getByRole("menuitem", { name: "No longer true" }))
    await waitFor(() => expect(within(digest).getByRole("img", { name: "Rejected" })).toBeInTheDocument())

    const decision = row(/Both pilot clinics sign the data agreement/)
    expect(within(decision).getByRole("button", { name: "Edit" })).toBeInTheDocument()
    await user.click(within(decision).getByRole("button", { name: "More actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Undo approval" }))
    await waitFor(() => expect(within(decision).getByRole("img", { name: "Rejected" })).toBeInTheDocument())
  })

  it("on an older memo offers only Edit and Erase on an approved fact, and says why", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    useMemory.setState((s) => (s.read?.kind === "ready" ? { read: { ...s.read, revoke: false } } : {}))
    await user.click(screen.getByRole("radio", { name: /In use/ }))
    const promise = row(/You promised Kai the pricing table/)
    await user.click(within(promise).getByRole("button", { name: "More actions" }))
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Erase…"])
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: /You promised Kai the pricing table/ }))
    expect(within(promise).getByText(/can take back the approval of a decision only/)).toBeInTheDocument()
  })

  it("takes back an agent's approved fact, which then waits for review again", async () => {
    const user = userEvent.setup()
    const discard = vi.spyOn(platform, "memoryDiscard")
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("radio", { name: /In use/ }))
    const promise = row(/You promised Kai the pricing table/)
    await user.click(within(promise).getByRole("button", { name: "More actions" }))
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Undo approval", "Erase…"])
    await user.click(screen.getByRole("menuitem", { name: "Undo approval" }))
    expect(discard).toHaveBeenCalledWith("fact:12")
    await waitFor(() => expect(within(promise).getByRole("img", { name: "To review" })).toBeInTheDocument())
  })

  it("approves, then undoes the approval through the More menu, by keyboard only", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    const scores = row(/Scores below 0.72 on the retrieval suite/)
    within(scores).getByRole("button", { name: "Approve" }).focus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(within(scores).getByRole("button", { name: "Edit" })).toHaveFocus())

    await user.tab()
    expect(within(scores).getByRole("button", { name: "More actions" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("menuitem", { name: "Undo approval" })).toHaveFocus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(within(scores).getByRole("img", { name: "Rejected" })).toBeInTheDocument())
    await waitFor(() => expect(scores.contains(document.activeElement)).toBe(true))
  })

  it("opens a filter list with the keyboard, and Escape gives focus back to its button", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    const kind = screen.getByRole("button", { name: "Kind" })
    kind.focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("listbox", { name: "Kind" })).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(kind).toHaveFocus()
    expect(kind).toHaveAttribute("aria-expanded", "false")
  })

  it("never shows a menu button that opens an empty menu", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await all(user)
    for (const more of screen.getAllByRole("button", { name: "More actions" })) {
      expect(more).toBeEnabled()
      await user.click(more)
      expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0)
      await user.keyboard("{Escape}")
    }
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

  it("shows the rest of memory, and says so, when memo does not list the links", async () => {
    const read = await platform.memoryRead()
    if (read.kind !== "ready") throw new Error("the mock memo is ready")
    vi.spyOn(platform, "memoryRead").mockResolvedValue({ ...read, linksError: "the program did not finish in time" })
    render(<MemoryPage />)
    await rack()
    expect(screen.getByText(/Links between people and companies are not shown/)).toHaveTextContent(
      "the program did not finish in time",
    )
  })
})
