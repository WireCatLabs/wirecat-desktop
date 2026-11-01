import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useTasks } from "./store"
import { TasksPage } from "./TasksPage"

beforeEach(() => useTasks.setState({ ...useTasks.getInitialState(), view: "table" }, true))
afterEach(() => vi.restoreAllMocks())

const row = (key: string) => document.querySelector(`[data-row="${key}"]`) as HTMLElement
const loaded = () => screen.findByRole("button", { name: /HRB-12 Send Kai the pricing table/ }, { timeout: 4000 })

describe("Tasks", () => {
  it("lists memo's tasks with their state, priority and who is on them", async () => {
    render(<TasksPage />)
    await loaded()
    const blocked = row("HRB-15")
    expect(blocked).toHaveTextContent("waits for HRB-14")
    expect(blocked).toHaveTextContent("claude-code is on it")
    expect(within(row("HRB-14")).getByRole("combobox", { name: "Priority of HRB-14" })).toHaveTextContent("Critical")
    expect(within(row("HRB-12")).getByRole("combobox", { name: "Status of HRB-12" })).toHaveTextContent("Progress")
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

  it("filters by a custom due day, with the calendar open at once", async () => {
    const user = userEvent.setup()
    const picker = vi.fn()
    HTMLInputElement.prototype.showPicker = picker
    const list = vi.spyOn(platform, "taskList")
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "Due" }))
    await user.click(screen.getByRole("option", { name: /^Today/ }))
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.stringContaining("(due:today)")))
    await user.click(screen.getByRole("button", { name: /^Due/ }))
    await user.click(screen.getByRole("option", { name: "Custom…" }))
    const from = screen.getByLabelText("From")
    await waitFor(() => expect(from).toHaveFocus())
    expect(picker).toHaveBeenCalled()
    fireEvent.change(from, { target: { value: "2026-12-01" } })
    fireEvent.change(screen.getByLabelText("To (optional)"), { target: { value: "2026-12-05" } })
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveValue("due:[2026-12-01 TO 2026-12-05]")
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
    const picker = vi.fn()
    HTMLInputElement.prototype.showPicker = picker
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("OPS-3")).getByRole("combobox", { name: "Due of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "Another day" }))
    const field = within(row("OPS-3")).getByLabelText("Due of OPS-3")
    expect(field).toHaveAttribute("type", "date")
    expect(field).toHaveFocus()
    expect(picker).toHaveBeenCalledOnce()
    await user.keyboard("{Escape}")
    expect(within(row("OPS-3")).getByRole("combobox", { name: "Due of OPS-3" })).toHaveFocus()
  })

  it("keeps a comment thread, adds a person by name and says why a task with subtasks stays", async () => {
    const user = userEvent.setup()
    const assign = vi.spyOn(platform, "taskAssign")
    render(<TasksPage />)
    await loaded()
    await user.click(within(row("HRB-12")).getByRole("button", { name: /^HRB-12 / }))
    const dialog = await screen.findByRole("dialog", { name: "Task HRB-12" })
    const thread = await within(dialog).findByRole("list")
    expect(thread).toHaveTextContent("Kai wants the per-seat price")
    await user.type(within(dialog).getByRole("textbox", { name: "Add a comment" }), "-Sent the second tab.")
    await user.click(within(dialog).getByRole("button", { name: "Comment" }))
    await waitFor(() => expect(within(thread).getAllByRole("listitem")).toHaveLength(3))
    expect(within(thread).getAllByRole("listitem")[2]).toHaveTextContent("You")

    await user.click(within(dialog).getByRole("combobox", { name: "Assignee of HRB-12" }))
    await user.click(screen.getByRole("option", { name: "Someone else…" }))
    await user.type(within(dialog).getByRole("combobox", { name: "Find or add a person" }), "Lena Ortiz{Enter}")
    await waitFor(() => expect(assign).toHaveBeenCalledWith("HRB-12", expect.any(Number), "person:4"))
    expect(useTasks.getState().people.map((p) => p.name)).toContain("Lena Ortiz")

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(within(row("OPS-3")).getByRole("button", { name: /^OPS-3 / }))
    const ops = await screen.findByRole("dialog", { name: "Task OPS-3" })
    await user.click(within(ops).getByRole("combobox", { name: "Project of OPS-3" }))
    await user.click(screen.getByRole("option", { name: "HOME · Home" }))
    expect(await within(ops).findByText(/it has subtasks/)).toBeInTheDocument()
    expect(within(ops).getByRole("button", { name: "Open OPS-5" })).toBeInTheDocument()
    await user.click(within(ops).getByRole("button", { name: "Open OPS-5" }))
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

  it("offers the update when memo is too old, and nothing else", async () => {
    vi.spyOn(platform, "taskList").mockResolvedValue({ kind: "old", version: "0.131.2", need: "0.131.4" })
    render(<TasksPage />)
    expect(await screen.findByText(/needs Memo 0.131.4 or newer; 0.131.2 is installed/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update Memo" })).toBeInTheDocument()
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  })

  it("adds a task with its project, then shows it first", async () => {
    const user = userEvent.setup()
    const create = vi.spyOn(platform, "taskCreate")
    render(<TasksPage />)
    await loaded()
    await user.click(screen.getByRole("button", { name: "New task" }))
    await user.click(screen.getByRole("button", { name: "Add task" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Type a title for the task.")
    expect(screen.getByRole("textbox", { name: "Title of the new task" })).toHaveFocus()
    await user.type(screen.getByRole("textbox", { name: "Title of the new task" }), "Print the flyers")
    await user.click(screen.getByRole("combobox", { name: "Project" }))
    await user.click(screen.getByRole("option", { name: /HOME · Home/ }))
    await user.click(screen.getByRole("button", { name: "Add task" }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ project: "HOME", title: "Print the flyers" }))
    await waitFor(() => expect(document.querySelector("[data-row]")).toHaveAttribute("data-row", "HOME-3"))
  })
})
