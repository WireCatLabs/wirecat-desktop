import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { Task } from "@/platform/task-schemas"
import { useNav } from "@/shared/nav"
import { render, screen, waitFor, within } from "@/testing/render"
import { personName } from "./parts"
import { useSource } from "./source"
import { useTasks } from "./store"
import { pageOf } from "./TaskBoard"
import { TasksPage } from "./TasksPage"

beforeEach(() => {
  useTasks.setState({ ...useTasks.getInitialState(), view: "table" }, true)
  useSource.setState({ source: null })
})
afterEach(() => vi.restoreAllMocks())

/** memo lists the tasks it found in messages with the project tasks, unless the query names a project. */
const listing = (found: Task[]) => {
  const list = platform.taskList.bind(platform)
  return vi.spyOn(platform, "taskList").mockImplementation(async (q) => {
    const read = await list(q)
    if (read.kind !== "ready" || /project:/.test(q)) return read
    return { ...read, tasks: [...read.tasks, ...found], total: read.total + found.length }
  })
}

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

describe("a person's name on a task", () => {
  const words = { you: "You", unnamed: "No name" } as Parameters<typeof personName>[2]
  const named = (name: string | null) => personName("person:7", [{ ref: "person:7", name, owner: false }], words)

  it("drops what a source wrote for a missing name", () => {
    expect(named("Kai null")).toBe("Kai")
    expect(named("null #97365")).toBe("No name")
    expect(named("+34600123456")).toBe("+34600123456")
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

  it("lists the tasks memo found in chats with the project tasks, and edits their fields as its account", async () => {
    const user = userEvent.setup()
    const found = (key: string, title: string) => ({
      key,
      project: "INDBB44DA4",
      projectName: null,
      createdBy: null,
      title,
      description: null,
      kind: "request",
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
    const chat0 = found("INDBB44DA4-7", "Send Ana the lease draft")
    listing([chat0])
    render(<TasksPage />)
    await loaded()
    const chat = row("INDBB44DA4-7")
    expect(chat).toHaveTextContent("Telegram")
    const update = vi.spyOn(platform, "taskUpdate").mockImplementation(async (_key, _revision, edit) => ({
      kind: "saved",
      task: { ...chat0, state: edit.state ?? chat0.state, revision: 2 },
      label: null,
      renumbered: [],
      moved: [],
    }))
    await user.click(within(chat).getByRole("combobox", { name: "Status of INDBB44DA4-7" }))
    expect(screen.getByRole("option", { name: "Todo" })).not.toHaveAttribute("aria-disabled", "true")
    await user.click(screen.getByRole("option", { name: "Todo" }))
    expect(update).toHaveBeenCalledWith("INDBB44DA4-7", 1, { state: "todo", account: "telegram:220195113" })

    await user.click(within(chat).getByRole("combobox", { name: "Priority of INDBB44DA4-7" }))
    await user.click(screen.getByRole("option", { name: /High/ }))
    expect(update).toHaveBeenLastCalledWith("INDBB44DA4-7", 2, { priority: "high", account: "telegram:220195113" })
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
    listing(Array.from({ length: 96 }, (_, i) => found(i + 1)))
    vi.spyOn(platform, "taskHistory").mockResolvedValue([])
    vi.spyOn(platform, "taskComments").mockResolvedValue([])
    render(<TasksPage />)
    const column = await screen.findByRole("region", { name: /^Open, \d+ tasks/ }, { timeout: 4000 })
    const cards = () => column.querySelectorAll("[data-card]")
    expect(cards()).toHaveLength(20)
    const total = Number(/\d+/.exec(column.getAttribute("aria-label") ?? "")?.[0])
    const card = within(column).getByRole("button", { name: "Q-1 Untitled question" })
    expect(card).not.toHaveTextContent("msg:telegram")
    expect(card).toHaveTextContent("Telegram")
    expect(card).not.toHaveTextContent("No priority")
    await user.click(within(column).getByRole("button", { name: `Show more (${total - 20})` }))
    expect(cards()).toHaveLength(40)

    await user.click(card)
    const dialog = await screen.findByRole("dialog", { name: "Task Q-1" })
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("")
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveAttribute("placeholder", "Untitled question")
    const update = vi.spyOn(platform, "taskUpdate").mockImplementation(async (_key, _revision, edit) => {
      if (edit.account !== "telegram:1") throw new Error("give --account — the stored accounts: --account telegram:1")
      return {
        kind: "saved",
        task: { ...found(1), title: "Hand over the keys", revision: 2 },
        label: null,
        renumbered: [],
        moved: [],
      }
    })
    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Hand over the keys")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("Q-1", 1, { title: "Hand over the keys", account: "telegram:1" }),
    )
    expect(within(dialog).queryByRole("alert")).toBeNull()
    await user.keyboard("{Escape}")
    expect(within(column).getByRole("button", { name: "Q-1 Hand over the keys" })).toHaveAttribute(
      "aria-roledescription",
    )

    await user.click(screen.getByRole("button", { name: "Source" }))
    await user.click(screen.getByRole("option", { name: /Projects/ }))
    await waitFor(() => expect(within(column).queryByRole("button", { name: /^Q-1 / })).toBeNull())
    expect(cards().length).toBe(total - 96)
  })

  it("shows where a found task came from and who has it", async () => {
    const user = userEvent.setup()
    const found = {
      key: "Q-9",
      project: "IN0BB44DA4",
      projectName: "telegram:1",
      createdBy: { type: "bot", name: "rule", owner: false },
      title: "Can you send the lease by Friday?",
      description: null,
      kind: "question",
      state: "open" as const,
      priority: null,
      priorityLabel: null,
      agent: null,
      revision: 2,
      parent: null,
      dueAt: null,
      closedAt: null,
      claimedBy: null,
      claimedUntil: null,
      assignees: ["person:1"],
      ready: null,
      blockedBy: [],
      createdAt: "2026-11-08T09:12:00.000Z",
      updatedAt: null,
      account: "telegram:1",
      source: "msg:telegram/1/2/15",
    }
    listing([found])
    vi.spyOn(platform, "taskHistory").mockResolvedValue([
      { at: found.createdAt, kind: "created", by: { ref: "bot:1", name: "rule", owner: false }, changes: [] },
    ])
    vi.spyOn(platform, "taskComments").mockResolvedValue([])
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("Q-9")).getByRole("button", { name: /^Q-9 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task Q-9" })
    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Assignee of Q-9" })).toHaveTextContent("You"),
    )
    expect(within(dialog).getByRole("combobox", { name: "Move to project of Q-9" })).toBeEnabled()
    expect(await within(dialog).findByText("Memo created it")).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent("rule")
    await user.click(within(dialog).getByRole("combobox", { name: "Type of Q-9" }))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Question",
      "Request",
      "Mention",
      "Promise",
    ])
    await user.keyboard("{Escape}")
    const source = within(dialog).getByRole("region", { name: "Source · Telegram" })
    expect(await within(source).findByText("Lease team")).toBeInTheDocument()
    expect(within(source).getByText("Ana Sample")).toBeInTheDocument()
    expect(source).toHaveTextContent("Answer it in the chat, then mark the task Done")
    const writeText = vi.spyOn(navigator.clipboard, "writeText")
    await user.click(within(dialog).getByRole("button", { name: "Copy id: task:Q-9" }))
    expect(writeText).toHaveBeenLastCalledWith("task:Q-9")
    await user.click(within(source).getByRole("button", { name: "Copy id: msg:telegram/1/2/15" }))
    expect(writeText).toHaveBeenLastCalledWith("msg:telegram/1/2/15")
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "!")
    await user.click(within(source).getByRole("button", { name: "Open in the chat" }))
    expect(within(source).getByRole("alert")).toHaveTextContent("Save or cancel your changes to the task first.")
    expect(useNav.getState().active).not.toBe("conversation")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await user.click(within(source).getByRole("button", { name: "Open in the chat" }))
    expect(useNav.getState().active).toBe("conversation")
    expect(useTasks.getState().open).toBeNull()
  })

  it("counts the filters again after an edit", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await waitFor(() => expect(useTasks.getState().counts).not.toBeNull())
    const count = (ref: string) => useTasks.getState().counts?.assignee.find((f) => f.value === ref)?.count ?? 0
    const mine = count("person:1")
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    await user.click(within(dialog).getByRole("combobox", { name: "Assignee of HRB-12" }))
    await user.click(screen.getByRole("option", { name: "Nobody" }))
    await waitFor(() => expect(count("person:1")).toBe(mine - 1))
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

    vi.spyOn(platform, "taskUpdate").mockRejectedValueOnce(new Error("database is locked"))
    await user.click(within(row("OPS-3")).getByRole("combobox", { name: "Status of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Done" }))
    const alert = await within(row("OPS-3")).findByRole("alert")
    expect(alert).toHaveTextContent("Not saved. WireCat is busy, most likely with a sync. Try again in a minute.")
    expect(alert).not.toHaveTextContent("database is locked")
    await user.click(within(alert).getByRole("button", { name: "Details" }))
    expect(alert).toHaveTextContent("database is locked")
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
    const tip = within(dialog).getByRole("button", { name: "Project" })
    expect(document.getElementById(tip.getAttribute("aria-describedby") ?? "")).toHaveTextContent(
      "Moving it to another project gives it a new key.",
    )
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
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Finish what you typed first")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await user.click(within(dialog).getAllByRole("button", { name: "Open HRB-14" })[0] as HTMLElement)
    expect(await screen.findByRole("dialog", { name: "Task HRB-14" })).toBeInTheDocument()
    await user.keyboard("j")
    expect(await screen.findByRole("dialog", { name: /^Task (?!HRB-14)/ })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect([...document.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row"))).toEqual(before)
  })

  it("keeps the form, the fields and the history in place through a save, and ends on Saved", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-15")).getByRole("button", { name: /^HRB-15 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-15" })
    const made = await within(dialog).findByText(/hermes created/)
    await user.click(within(dialog).getByRole("button", { name: "Edit" }))
    const notes = within(dialog).getByRole("textbox", { name: "Notes" })
    await user.clear(notes)
    await user.type(notes, "New notes  ")

    const current = useTasks.getState().tasks.find((t) => t.key === "HRB-15")
    if (!current) throw new Error("no HRB-15")
    let answer: () => void = () => undefined
    vi.spyOn(platform, "taskUpdate").mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = () =>
            // memo trims what it stores.
            resolve({
              kind: "saved",
              task: { ...current, description: "New notes", revision: current.revision + 1 },
              label: null,
              renumbered: [],
              moved: [],
            })
        }),
    )
    const save = within(dialog).getByRole("button", { name: "Save" })
    await user.click(save)
    await waitFor(() => expect(save).toHaveAttribute("aria-busy", "true"))
    expect(save).toHaveTextContent("Saving…")
    expect(save).toBeEnabled()
    expect(save).toHaveFocus()
    expect(within(dialog).getByRole("combobox", { name: "Status of HRB-15" })).toBeEnabled()

    answer()
    await waitFor(() => expect(save).toHaveTextContent("Saved"))
    expect(save).toHaveFocus()
    expect(within(dialog).getByRole("textbox", { name: "Notes" })).toBe(notes)
    expect(made).toBeInTheDocument()
    expect(within(dialog).getByRole("status", { name: "" })).toHaveTextContent("Saved")

    await user.type(notes, " More")
    expect(save).toHaveTextContent("Save")
    expect(save).not.toHaveTextContent("Saved")
  })

  it("shows what memo kept when it stores something else than was typed", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-15")).getByRole("button", { name: /^HRB-15 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-15" })
    await user.click(within(dialog).getByRole("button", { name: "Edit" }))
    const notes = within(dialog).getByRole("textbox", { name: "Notes" })
    await user.clear(notes)
    await user.type(notes, "None")
    const current = useTasks.getState().tasks.find((t) => t.key === "HRB-15")
    if (!current) throw new Error("no HRB-15")
    vi.spyOn(platform, "taskUpdate").mockResolvedValueOnce({
      kind: "saved",
      task: { ...current, description: null, revision: current.revision + 1 },
      label: null,
      renumbered: [],
      moved: [],
    })
    const save = within(dialog).getByRole("button", { name: "Save" })
    await user.click(save)
    await waitFor(() => expect(save).toHaveTextContent("Saved"))
    expect(notes).toHaveValue("")
  })

  it("does not lose unsaved text to a close or a link: the first try warns, a second close discards", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-15")).getByRole("button", { name: /^HRB-15 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-15" })
    await user.type(within(dialog).getByRole("textbox", { name: "Add a comment" }), "Not sent yet")

    await user.click(within(dialog).getAllByRole("button", { name: "Open HRB-14" })[0] as HTMLElement)
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Finish what you typed first")
    expect(useTasks.getState().open).toBe("HRB-15")

    const close = within(dialog).getByRole("button", { name: "Close" })
    await user.click(close)
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Close again to discard")
    expect(within(dialog).getByRole("textbox", { name: "Add a comment" })).toHaveValue("Not sent yet")
    await user.click(close)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("keeps what the owner typed when memo refuses the save because someone changed the task", async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    const current = useTasks.getState().tasks.find((t) => t.key === "HRB-12")
    if (!current) throw new Error("no HRB-12")
    vi.spyOn(platform, "taskUpdate").mockResolvedValueOnce({
      kind: "stale",
      current: { ...current, title: "Their title", revision: current.revision + 1 },
      last: null,
    })
    const title = within(dialog).getByRole("textbox", { name: "Title" })
    await user.clear(title)
    await user.type(title, "My title")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))
    expect(await within(dialog).findByText(/still in the form/)).toBeInTheDocument()
    expect(title).toHaveValue("My title")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(title).toHaveValue("Their title")
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
    await waitFor(() => expect(assign).toHaveBeenCalledWith("HRB-12", expect.any(Number), "person:4", undefined))
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

  it("shows a comment while memo saves it, and gives the text back when memo refuses", async () => {
    const user = userEvent.setup()
    let refuse: (e: Error) => void = () => {}
    vi.spyOn(platform, "taskCommentAdd").mockImplementation(() => new Promise((_, reject) => (refuse = reject)))
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    const thread = (await within(dialog).findByText(/Kai wants the per-seat price/)).closest("ol") as HTMLElement
    const before = within(thread).getAllByRole("listitem").length
    const box = within(dialog).getByRole("textbox", { name: "Add a comment" })
    await user.type(box, "Booked the hall")
    await user.click(within(dialog).getByRole("button", { name: "Comment" }))
    expect(box).toHaveValue("")
    const saving = within(thread).getAllByRole("listitem")[before]
    expect(saving).toHaveTextContent("Booked the hall")
    expect(saving).toHaveAttribute("aria-busy", "true")
    expect(saving).toHaveTextContent("Sending…")
    refuse(new Error("another memo process holds the store; try again in a minute"))
    await waitFor(() => expect(box).toHaveValue("Booked the hall"))
    expect(within(thread).getAllByRole("listitem")).toHaveLength(before)
    expect(within(dialog).getByRole("alert")).toHaveTextContent("The comment was not added. Your text is still here.")
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
      expect(move).toHaveBeenCalledWith("OPS-3", expect.any(Number), { state: "todo", before: "HRB-14" }, undefined),
    )
    const todo = screen.getByRole("region", { name: /^Todo, 3 tasks/ })
    expect(within(todo).getAllByRole("button", { name: /^(OPS|HRB)-\d+ / })[0]).toHaveAccessibleName(/^OPS-3/)
  })

  it("moves a card to another column by pointer, saves its status, and counts the columns again", async () => {
    const user = userEvent.setup()
    useTasks.setState({ view: "board" })
    const move = vi.spyOn(platform, "taskMove")
    render(<TasksPage />)
    const card = await screen.findByRole("button", { name: /^HOME-2 / }, { timeout: 4000 })
    const progress = document.querySelector('[data-column="in_progress"]') as HTMLElement
    const label = () => screen.getByRole("region", { name: /^Progress, / }).getAttribute("aria-label") ?? ""
    const counted = () => Number(/(\d+) tasks?/.exec(label())?.[1])
    const before = counted()
    document.elementsFromPoint = () => [progress]
    await user.pointer([
      { keys: "[MouseLeft>]", target: card, coords: { clientX: 20, clientY: 20 } },
      { target: card, coords: { clientX: 400, clientY: 60 } },
      { keys: "[/MouseLeft]", target: card },
    ])
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        "HOME-2",
        expect.any(Number),
        expect.objectContaining({ state: "in_progress" }),
        undefined,
      ),
    )
    await waitFor(() => expect(counted()).toBe(before + 1))
  })

  it("moves a found task on the board as its account", async () => {
    const user = userEvent.setup()
    useTasks.setState({ view: "board" })
    const found = {
      key: "Q-3",
      project: "IN0BB44DA4",
      projectName: null,
      createdBy: null,
      title: "Can you send the lease?",
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
    }
    listing([found])
    const move = vi.spyOn(platform, "taskMove").mockResolvedValue({
      kind: "saved",
      task: { ...found, state: "in_progress", revision: 2 },
      label: null,
      renumbered: [],
      moved: [],
    })
    render(<TasksPage />)
    await screen.findByRole("button", { name: /^Q-3 / }, { timeout: 4000 })
    // A card that changes column is a new element.
    const card = () => screen.getByRole("button", { name: /^Q-3 / })
    const column = document.querySelector('[data-column="in_progress"]') as HTMLElement
    document.elementsFromPoint = () => [column]
    await user.pointer([
      { keys: "[MouseLeft>]", target: card(), coords: { clientX: 20, clientY: 20 } },
      { target: card(), coords: { clientX: 400, clientY: 60 } },
      { keys: "[/MouseLeft]", target: card() },
    ])
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith("Q-3", 1, expect.objectContaining({ state: "in_progress" }), "telegram:1"),
    )
    await waitFor(() => expect(card().closest("[data-column]")).toHaveAttribute("data-column", "in_progress"))
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
