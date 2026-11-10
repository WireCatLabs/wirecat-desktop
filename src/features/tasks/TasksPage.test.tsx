import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { useSource } from "./source"
import { useTasks } from "./store"
import { pageOf } from "./TaskBoard"
import { TasksPage } from "./TasksPage"

beforeEach(() => {
  useTasks.setState({ ...useTasks.getInitialState(), view: "table" }, true)
  useSource.setState({ source: null })
})
afterEach(() => vi.restoreAllMocks())

const row = (key: string) => document.querySelector(`[data-row="${key}"]`) as HTMLElement
const loaded = () => screen.findByRole("button", { name: /HRB-12 Send Kai the pricing table/ }, { timeout: 4000 })

describe("a board column's page", () => {
  it("shows the first cards, and a card held by the keyboard past them too", () => {
    const keys = ["a", "b", "c", "d"]
    expect(pageOf(keys, 2)).toEqual(["a", "b"])
    expect(pageOf(keys, 2, "d")).toEqual(keys)
    expect(pageOf(keys, 9)).toEqual(keys)
  })
})

describe("Tasks", () => {
  it("lists memo's tasks with their state, priority and who is on them", async () => {
    render(<TasksPage />)
    await loaded()
    const blocked = row("HRB-15")
    expect(blocked).toHaveTextContent("waits for HRB-14")
    expect(blocked).toHaveTextContent("claude-code is on it")
    expect(within(row("HRB-14")).getByRole("combobox", { name: "Priority of HRB-14" })).toHaveTextContent("Critical")
    const priority = (key: string) => within(row(key)).getByRole("combobox", { name: `Priority of ${key}` })
    const bars = (key: string) => priority(key).querySelectorAll("span[aria-hidden] > span").length
    expect(bars("HRB-14")).toBe(3)
    expect(bars("HOME-2")).toBe(0)
    expect(within(row("HRB-12")).getByRole("combobox", { name: "Status of HRB-12" })).toHaveTextContent("Progress")
  })

  it("shows the tasks memo found in chats beside the project tasks, read only, while nothing is searched", async () => {
    const user = userEvent.setup()
    const found = (key: string, title: string) => ({
      key,
      project: "INDBB44DA4",
      projectName: null,
      createdBy: null,
      title,
      description: null,
      kind: null,
      state: "open" as const,
      priority: null,
      priorityLabel: null,
      agent: null,
      revision: 1,
      parent: null,
      dueAt: null,
      closedAt: null,
      claimedBy: null,
      claimedUntil: null,
      assignees: [],
      ready: null,
      blockedBy: [],
      createdAt: "2026-11-08T09:12:00.000Z",
      updatedAt: null,
      account: "telegram:220195113",
    })
    const chats = vi
      .spyOn(platform, "taskChats")
      .mockResolvedValue({ tasks: [found("INDBB44DA4-7", "Send Ana the lease draft")], more: false })
    render(<TasksPage />)
    await loaded()
    const chat = row("INDBB44DA4-7")
    expect(chat).toHaveTextContent("found in your messages")
    expect(within(chat).getByRole("combobox", { name: "Status of INDBB44DA4-7" })).toBeDisabled()
    expect(within(chat).getByRole("combobox", { name: "Priority of INDBB44DA4-7" })).toBeDisabled()
    expect(useTasks.getState().total).toBe(useTasks.getState().tasks.length)
    await user.click(screen.getByRole("button", { name: "Project" }))
    await user.click(screen.getByRole("option", { name: /Operations/ }))
    await waitFor(() => expect(row("INDBB44DA4-7")).toBeNull())
    expect(chats).toHaveBeenCalledTimes(1)
  })

  it("names a found task by its kind while its title is only the message's address, and pages a long column", async () => {
    const user = userEvent.setup()
    useTasks.setState({ view: "board" })
    const found = (n: number) => ({
      key: `Q-${n}`,
      project: "INDBB44DA4",
      projectName: null,
      createdBy: null,
      title: `question — msg:telegram/1/7/${n}`,
      description: null,
      kind: "question",
      state: "open" as const,
      priority: null,
      priorityLabel: null,
      agent: null,
      revision: 1,
      parent: null,
      dueAt: null,
      closedAt: null,
      claimedBy: null,
      claimedUntil: null,
      assignees: [],
      ready: null,
      blockedBy: [],
      createdAt: "2026-11-08T09:12:00.000Z",
      updatedAt: null,
      account: "telegram:1",
    })
    vi.spyOn(platform, "taskChats").mockResolvedValue({
      tasks: Array.from({ length: 96 }, (_, i) => found(i + 1)),
      more: false,
    })
    render(<TasksPage />)
    const column = await screen.findByRole("region", { name: /^Open, \d+ tasks/ }, { timeout: 4000 })
    const cards = () => column.querySelectorAll("[data-card]")
    expect(cards()).toHaveLength(20)
    const total = Number(/\d+/.exec(column.getAttribute("aria-label") ?? "")?.[0])
    const card = within(column).getByRole("button", { name: "Q-1 A question in a message" })
    expect(card).not.toHaveTextContent("msg:telegram")
    expect(card).toHaveTextContent("Telegram")
    expect(card).not.toHaveTextContent("No priority")
    await user.click(within(column).getByRole("button", { name: `Show more (${total - 20})` }))
    expect(cards()).toHaveLength(40)

    await user.click(card)
    const dialog = await screen.findByRole("dialog", { name: "Task Q-1" })
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("")
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveAttribute(
      "placeholder",
      "A question in a message",
    )
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Source" }))
    await user.click(screen.getByRole("option", { name: /Projects/ }))
    await waitFor(() => expect(within(column).queryByRole("button", { name: /^Q-1 / })).toBeNull())
    expect(cards().length).toBe(total - 96)
  })

  it("writes a filter into the search, which memo answers", async () => {
    const user = userEvent.setup()
    const list = vi.spyOn(platform, "taskList")
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "Project" }))
    await user.click(screen.getByRole("option", { name: /Operations/ }))
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveValue("project:OPS")
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.stringContaining("(project:OPS)")))
    await waitFor(() => expect(row("HRB-12")).toBeNull())
    expect(row("OPS-3")).not.toBeNull()
  })

  it("filters by a custom due range picked on the calendar, which opens focused", async () => {
    const user = userEvent.setup()
    const list = vi.spyOn(platform, "taskList")
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "Due" }))
    await user.click(screen.getByRole("option", { name: /^Today/ }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.stringContaining("(due:today)")))
    expect(screen.getByRole("button", { name: "Due: Today" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Due/ }))
    await user.click(screen.getByRole("option", { name: "Custom…" }))
    const calendar = screen.getByRole("dialog", { name: "Custom…" })
    const today = within(calendar).getByRole("button", { current: "date" })
    await waitFor(() => expect(today).toHaveFocus())
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{Enter}")
    const from = today.getAttribute("data-day")
    const day = new Date(`${from}T00:00:00`)
    day.setDate(day.getDate() + 2)
    const to = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveValue(`due:[${from} TO ${to}]`)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Custom…" })).not.toBeInTheDocument()
  })

  it("makes a range that starts tomorrow, which memo writes as the word tomorrow", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "Due" }))
    await user.click(screen.getByRole("option", { name: "Custom…" }))
    const calendar = screen.getByRole("dialog", { name: "Custom…" })
    const today = within(calendar).getByRole("button", { current: "date" })
    await waitFor(() => expect(today).toHaveFocus())
    await user.keyboard("{ArrowRight}{Enter}{ArrowRight}{Enter}")
    const day = (n: number) => {
      const d = new Date(`${today.getAttribute("data-day")}T00:00:00`)
      d.setDate(d.getDate() + n)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    }
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveValue(`due:[${day(1)} TO ${day(2)}]`)
  })

  it("clears one filter from its chip and keeps the rest of the search", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    const search = screen.getByRole("searchbox", { name: "Search tasks" })
    await user.type(search, "launch priority:high")
    expect(await screen.findByRole("button", { name: "Priority: High" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear priority" }))
    expect(search).toHaveValue("launch")
    expect(screen.getByRole("button", { name: "Priority" })).toHaveFocus()
  })

  it("keeps an edited row in its place and says nothing changed when memo refuses", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    const before = [...document.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row"))
    await user.click(within(row("OPS-3")).getByRole("combobox", { name: "Priority of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Low" }))
    await waitFor(() =>
      expect(within(row("OPS-3")).getByRole("combobox", { name: /Priority/ })).toHaveTextContent("Low"),
    )
    expect([...document.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row"))).toEqual(before)

    vi.spyOn(platform, "taskUpdate").mockRejectedValueOnce(new Error("the store is busy"))
    await user.click(within(row("OPS-3")).getByRole("combobox", { name: "Status of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Done" }))
    expect(await within(row("OPS-3")).findByRole("alert")).toHaveTextContent(
      "The change was not saved: the store is busy. Nothing changed.",
    )
    expect(within(row("OPS-3")).getByRole("combobox", { name: /Status/ })).toHaveTextContent("Open")
  })

  it("shows the task as it now is when someone changed it first", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    const current = useTasks.getState().tasks.find((t) => t.key === "HRB-12")
    if (!current) throw new Error("no HRB-12")
    vi.spyOn(platform, "taskUpdate").mockResolvedValueOnce({
      kind: "stale",
      current: { ...current, state: "todo", revision: current.revision + 1 },
      last: {
        at: "2026-11-01T08:16:00Z",
        kind: "status",
        by: { ref: "bot:4", name: "hermes", owner: false },
        changes: [{ field: "status", from: "in_progress", to: "todo" }],
      },
    })
    await user.click(within(row("HRB-12")).getByRole("combobox", { name: "Priority of HRB-12" }))
    await user.click(screen.getByRole("option", { name: "Critical" }))
    const alert = await within(row("HRB-12")).findByRole("alert")
    expect(alert).toHaveTextContent("HRB-12 changed elsewhere: hermes changed the status at")
    expect(within(row("HRB-12")).getByRole("combobox", { name: /Status/ })).toHaveTextContent("Todo")
    expect(within(alert).getByRole("button", { name: "Read again" })).toBeInTheDocument()
  })

  it("opens a row in a dialog that edits every field and follows what the task waits for", async () => {
    const user = userEvent.setup()
    const update = vi.spyOn(platform, "taskUpdate")
    render(<TasksPage />)
    await loaded()
    const before = [...document.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row"))
    await user.click(within(row("HRB-15")).getByRole("button", { name: /^HRB-15 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-15" })
    expect(within(dialog).getByText("Created")).toBeInTheDocument()
    expect(await within(dialog).findByText(/by hermes$/)).toBeInTheDocument()
    expect(within(dialog).getByText("Moving it gives it a new key; the old key still finds it.")).toBeInTheDocument()
    const notes = within(dialog).getByRole("article", { name: "Notes" })
    expect(notes).toHaveTextContent("Waits until both pilot clinics have said yes.")
    await user.click(within(notes).getByRole("button", { name: "Edit" }))
    await waitFor(() => expect(within(dialog).getByRole("textbox", { name: "Notes" })).toHaveFocus())

    await user.click(within(dialog).getByRole("combobox", { name: "Priority of HRB-15" }))
    await user.click(screen.getByRole("option", { name: "Low" }))
    await waitFor(() => expect(update).toHaveBeenCalledWith("HRB-15", expect.any(Number), { priority: "low" }))

    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), " Soon.")
    await user.click(within(dialog).getByRole("button", { name: "Next task" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Save or discard your changes first.")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await user.click(within(dialog).getAllByRole("button", { name: "Open HRB-14" })[0] as HTMLElement)
    expect(await screen.findByRole("dialog", { name: "Task HRB-14" })).toBeInTheDocument()
    await user.keyboard("j")
    expect(await screen.findByRole("dialog", { name: /^Task (?!HRB-14)/ })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect([...document.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row"))).toEqual(before)
  })

  it("edits a task opened before the list arrived, and the row shows the change", async () => {
    const user = userEvent.setup()
    void useTasks.getState().openTask("OPS-3")
    render(<TasksPage />)
    await loaded()
    const dialog = await screen.findByRole("dialog", { name: "Task OPS-3" })
    await user.click(await within(dialog).findByRole("combobox", { name: "Priority of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Low" }))
    await waitFor(() =>
      expect(within(row("OPS-3")).getByRole("combobox", { name: /Priority/ })).toHaveTextContent("Low"),
    )
  })

  it("opens the calendar as soon as Another day is chosen, and Escape gives the cell back", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("OPS-3")).getByRole("combobox", { name: "Due of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Another day" }))
    const calendar = screen.getByRole("dialog", { name: "Due of OPS-3" })
    await waitFor(() => expect(within(calendar).getByRole("button", { pressed: true })).toHaveFocus())
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Due of OPS-3" })).not.toBeInTheDocument()
    expect(within(row("OPS-3")).getByRole("combobox", { name: "Due of OPS-3" })).toHaveFocus()
  })

  it("closes only the calendar on Escape inside the task dialog", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    await user.click(within(dialog).getByRole("combobox", { name: "Due of HRB-12" }))
    await user.click(screen.getByRole("option", { name: "Another day" }))
    const calendar = within(dialog).getByRole("dialog", { name: "Due of HRB-12" })
    await waitFor(() => expect(within(calendar).getByRole("button", { pressed: true })).toHaveFocus())
    await user.keyboard("{Escape}")
    expect(within(dialog).queryByRole("dialog", { name: "Due of HRB-12" })).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Task HRB-12" })).toBeInTheDocument()
  })

  it("keeps a comment thread, adds a person by name and moves a subtask out on its own", async () => {
    const user = userEvent.setup()
    const assign = vi.spyOn(platform, "taskAssign")
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    // The task's history is a list too, and may arrive first.
    const thread = (await within(dialog).findByText(/Kai wants the per-seat price/)).closest("ol") as HTMLElement
    await user.click(within(dialog).getByRole("button", { name: "Comment" }))
    expect(within(dialog).getByText("Write a comment first, then send it.")).toBeInTheDocument()
    await user.type(within(dialog).getByRole("textbox", { name: "Add a comment" }), "-Sent the second tab.")
    await user.click(within(dialog).getByRole("button", { name: "Comment" }))
    await waitFor(() => expect(within(thread).getAllByRole("listitem")).toHaveLength(3))
    expect(within(thread).getAllByRole("listitem")[2]).toHaveTextContent("You")

    await user.click(within(dialog).getByRole("combobox", { name: "Assignee of HRB-12" }))
    await user.click(screen.getByRole("option", { name: "Someone else…" }))
    await user.type(within(dialog).getByRole("combobox", { name: "Find or add a person" }), "Lena Ortiz")
    await screen.findByRole("option", { name: "Add “Lena Ortiz”" })
    await user.keyboard("{Enter}")
    await waitFor(() => expect(assign).toHaveBeenCalledWith("HRB-12", expect.any(Number), "person:4"))
    expect(useTasks.getState().people.map((p) => p.name)).toContain("Lena Ortiz")

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(within(row("OPS-5")).getByRole("button", { name: /^OPS-5 / }))
    const sub = await screen.findByRole("dialog", { name: "Task OPS-5" })
    await user.click(within(sub).getByRole("combobox", { name: "Project of OPS-5" }))
    await user.click(screen.getByRole("option", { name: "HRB · Harbour launch" }))
    await user.click(await within(sub).findByRole("button", { name: "Move it to HRB on its own (it leaves OPS-3)" }))
    expect(await screen.findByRole("dialog", { name: "Task HRB-16" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(within(row("OPS-3")).getByRole("button", { name: /^OPS-3 / }))
    const back = await screen.findByRole("dialog", { name: "Task OPS-3" })

    await user.click(within(back).getByRole("combobox", { name: "Type of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Bug" }))
    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(within(row("OPS-4")).getByRole("button", { name: /^OPS-4 / }))
    const away = await screen.findByRole("dialog", { name: "Task OPS-4" })
    await user.click(within(away).getByRole("combobox", { name: "Project of OPS-4" }))
    await user.click(screen.getByRole("option", { name: "HRB · Harbour launch" }))
    expect(await screen.findByRole("dialog", { name: "Task HRB-17" })).toBeInTheDocument()
    expect(row("HRB-17")).toBeInTheDocument()
    expect(row("OPS-4")).toBeNull()
  })

  it("says which subtasks a move to another project took along", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    const task = useTasks.getState().tasks.find((t) => t.key === "HRB-12")
    if (!task) throw new Error("no HRB-12")
    vi.spyOn(platform, "taskUpdate").mockResolvedValue({
      kind: "saved",
      task: { ...task, key: "HOME-9", project: "HOME", projectName: "Home", revision: task.revision + 1 },
      label: null,
      renumbered: [],
      moved: [{ from: "HRB-13", to: "HOME-10" }],
    })
    await user.click(within(dialog).getByRole("combobox", { name: "Project of HRB-12" }))
    await user.click(screen.getByRole("option", { name: "HOME · Home" }))
    const moved = await screen.findByRole("dialog", { name: "Task HOME-9" })
    expect(await within(moved).findByText("Its subtask moved with it:")).toBeInTheDocument()
    expect(within(moved).getByRole("button", { name: "Open HOME-10" })).toBeInTheDocument()
  })

  it("moves a card between columns with the keyboard and says each step", async () => {
    const user = userEvent.setup()
    useTasks.setState({ view: "board" })
    const move = vi.spyOn(platform, "taskMove")
    render(<TasksPage />)
    const card = await screen.findByRole(
      "button",
      { name: "OPS-3 Renew the domain and check the DNS records" },
      { timeout: 4000 },
    )
    card.focus()
    await user.keyboard(" ")
    expect(screen.getByText(/Picked up OPS-3/)).toBeInTheDocument()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByText("Todo, place 1 of 3.")).toBeInTheDocument()
    await user.keyboard(" ")
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith("OPS-3", expect.any(Number), { state: "todo", before: "HRB-14" }),
    )
    const todo = screen.getByRole("region", { name: /^Todo, 3 tasks/ })
    expect(within(todo).getAllByRole("button", { name: /^(OPS|HRB)-\d+ / })[0]).toHaveAccessibleName(/^OPS-3/)
  })

  it("opens a card on a click, never at the end of a drag", async () => {
    const user = userEvent.setup()
    useTasks.setState({ view: "board" })
    document.elementsFromPoint = () => []
    render(<TasksPage />)
    const card = await screen.findByRole("button", { name: /^OPS-3 / }, { timeout: 4000 })
    await user.pointer([
      { keys: "[MouseLeft>]", target: card, coords: { clientX: 20, clientY: 20 } },
      { target: card, coords: { clientX: 60, clientY: 40 } },
      { target: card, coords: { clientX: 22, clientY: 21 } },
      { keys: "[/MouseLeft]", target: card },
    ])
    expect(screen.queryByRole("dialog")).toBeNull()
    await user.click(card)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("writes nothing for a card put down where it was, with Ctrl held by pointer or keyboard", async () => {
    const user = userEvent.setup()
    useTasks.setState({ view: "board" })
    const move = vi.spyOn(platform, "taskMove")
    render(<TasksPage />)
    const card = await screen.findByRole("button", { name: /^OPS-3 / }, { timeout: 4000 })
    const column = card.closest<HTMLElement>("[data-column]")
    document.elementsFromPoint = () => (column ? [column] : [])
    await user.keyboard("{Control>}")
    await user.pointer([
      { keys: "[MouseLeft>]", target: card, coords: { clientX: 20, clientY: 20 } },
      { target: card, coords: { clientX: 60, clientY: 40 } },
      { keys: "[/MouseLeft]", target: card },
    ])
    await user.keyboard("{/Control}")
    expect(screen.getByText("OPS-3 put back.")).toBeInTheDocument()
    card.focus()
    await user.keyboard(" {Control>} {/Control}")
    expect(screen.getByText("OPS-3 put back.")).toBeInTheDocument()
    expect(move).not.toHaveBeenCalled()
  })

  it("offers the update when memo is too old, and nothing else", async () => {
    vi.spyOn(platform, "taskList").mockResolvedValue({ kind: "old", version: "0.131.2", need: "0.131.4" })
    render(<TasksPage />)
    expect(await screen.findByText(/needs Memo 0.131.4 or newer; this computer has 0.131.2/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update Memo" })).toBeInTheDocument()
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  })

  it("adds a task in a dialog, with its project, then shows it first", async () => {
    const user = userEvent.setup()
    const create = vi.spyOn(platform, "taskCreate")
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "New task" }))
    const dialog = await screen.findByRole("dialog", { name: "New task" })
    await user.click(within(dialog).getByRole("button", { name: "Add task" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Type a title for the task.")
    expect(within(dialog).getByRole("textbox", { name: "Title of the new task" })).toHaveFocus()
    await user.type(within(dialog).getByRole("textbox", { name: "Title of the new task" }), "Print the flyers")
    await user.click(within(dialog).getByRole("combobox", { name: "Project" }))
    await user.click(screen.getByRole("option", { name: /HOME · Home/ }))
    await user.click(within(dialog).getByRole("button", { name: "Add task" }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ project: "HOME", title: "Print the flyers" }))
    await waitFor(() => expect(document.querySelector("[data-row]")).toHaveAttribute("data-row", "HOME-3"))
    await waitFor(() => expect(useTasks.getState().creating).toBe(false))
  })

  it("finds an assignee by name in memo, once per search, and never reads everyone to do it", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "peopleSearch")
    const create = vi.spyOn(platform, "taskCreate")
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "New task" }))
    const dialog = await screen.findByRole("dialog", { name: "New task" })
    await user.type(within(dialog).getByRole("textbox", { name: "Title of the new task" }), "Call Kai")
    await user.click(within(dialog).getByRole("combobox", { name: "Project" }))
    await user.click(screen.getByRole("option", { name: /HOME · Home/ }))
    await user.click(within(dialog).getByRole("combobox", { name: "Assignee" }))
    await user.click(screen.getByRole("option", { name: "Someone else…" }))
    await user.type(within(dialog).getByRole("combobox", { name: "Find or add a person" }), "kai")
    // The page has already read the finder's first list (memo's people, owner first) to know who the owner is.
    await waitFor(() => expect(search).toHaveBeenCalledWith("kai"))
    const kai = await screen.findByRole("option", { name: "Kai Moreno" })
    expect(search).not.toHaveBeenCalledWith("k")
    await user.click(kai)
    await user.click(within(dialog).getByRole("button", { name: "Add task" }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        project: "HOME",
        title: "Call Kai",
        assignee: expect.stringMatching(/^person:/),
      }),
    )

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New task" })).not.toBeInTheDocument())
    const calls = search.mock.calls.length
    await user.click(screen.getByRole("button", { name: "New task" }))
    const again = await screen.findByRole("dialog", { name: "New task" })
    await user.click(within(again).getByRole("combobox", { name: "Assignee" }))
    await user.click(screen.getByRole("option", { name: "Someone else…" }))
    await user.type(within(again).getByRole("combobox", { name: "Find or add a person" }), "kai")
    expect(await screen.findByRole("option", { name: "Kai Moreno" })).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 400))
    expect(search.mock.calls.length).toBe(calls)
  })
})
