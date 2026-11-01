import { render, screen, waitFor, within } from "@testing-library/react"
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
      "Memo did not save the change: the store is busy. Nothing changed.",
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
    await user.type(screen.getByRole("textbox", { name: "Title of the new task" }), "Print the flyers")
    await user.click(screen.getByRole("combobox", { name: "Project" }))
    await user.click(screen.getByRole("option", { name: /HOME · Home/ }))
    await user.click(screen.getByRole("button", { name: "Add task" }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ project: "HOME", title: "Print the flyers" }))
    await waitFor(() => expect(document.querySelector("[data-row]")).toHaveAttribute("data-row", "HOME-3"))
  })
})
