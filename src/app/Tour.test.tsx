import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useMemory } from "@/features/memory/store"
import { useOnboarding } from "@/features/onboarding/store"
import { useTour } from "@/features/onboarding/Tour"
import { useSearch } from "@/features/search/store"
import { useTasks } from "@/features/tasks/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const MEMORY_EXAMPLE = "Ana Ruiz promised to send the signed contract by Thursday."
const TASK_EXAMPLE = "Check the signed contract from Ana"
const SEARCH_ASK = "what Ana said about the contract this month"
const SEARCH_HIT = "I'll send the signed contract by Thursday, the clinic annex is in it too."
const KAI = "Kai Moreno prefers calls on Friday afternoons and asks for the agenda the evening before."
const BEFORE_TASKS = ["Status lamps", "One action per tool", "Agents", "How it works with your agent"]
const SEARCH_STOPS = ["Search", "Ask in your own words", "Open a result"]
const TASK_STOPS = ["Tasks", "Table or board", "Who, how urgent, by when"]

const navItem = (name: string) =>
  ["Sections", "Data and settings"]
    .flatMap((nav) =>
      within(screen.getByRole("navigation", { name: nav })).queryAllByRole("button", { name: new RegExp(`^${name}`) }),
    )
    .at(0) as HTMLElement
const page = (name: string) => {
  const item = navItem(name)
  expect(item).toHaveAttribute("aria-current", "page")
  return item
}

async function startTour(rendered = false) {
  const user = userEvent.setup()
  if (!rendered) render(<App />)
  await screen.findByRole("list", { name: "WireCat tools" })
  await user.click(screen.getByRole("button", { name: "Help" }))
  await user.click(screen.getByRole("menuitem", { name: "Take the tour" }))
  await screen.findByRole("dialog", { name: "Tools" })
  return user
}

async function next(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Next" }))
  return screen.findByRole("dialog", { name: title }, { timeout: 3000 })
}

describe("Tour", () => {
  beforeEach(() => {
    localStorage.clear()
    useOnboarding.setState({ status: "done", open: false })
  })
  afterEach(() => {
    useTour.getState().close()
    vi.restoreAllMocks()
  })

  it("opens each stop's page, Agents included, before pointing at it", async () => {
    const user = await startTour()
    expect(page("Tools")).toBeInTheDocument()

    const stops: [string, string][] = [
      ["Status lamps", "Tools"],
      ["One action per tool", "Tools"],
      ["Agents", "Agents"],
      ["How it works with your agent", "Agents"],
      ["Search", "Search"],
      ["Ask in your own words", "Search"],
      ["Open a result", "Search"],
      ["Tasks", "Tasks"],
      ["Table or board", "Tasks"],
      ["Who, how urgent, by when", "Tasks"],
      ["Memory", "Memory"],
      ["Approve or correct", "Memory"],
      ["Where it came from", "Memory"],
      ["Storage, Logs and Settings", "Storage"],
      ["Help is here", "Storage"],
      ["Your first guide", "Guides"],
    ]
    for (const [title, section] of stops) {
      await next(user, title)
      await waitFor(() => expect(page(section)).toBeInTheDocument())
    }
  }, 20000)

  it("shows example rows on Tasks and Memory only while the tour stands there", async () => {
    const first = userEvent.setup()
    render(<App />)
    await first.click(navItem("Tasks"))
    await screen.findByRole("heading", { level: 1, name: "Tasks" })
    expect(screen.queryByText(TASK_EXAMPLE)).not.toBeInTheDocument()
    await first.click(navItem("Tools"))
    const user = await startTour(true)

    for (const title of [...BEFORE_TASKS, ...SEARCH_STOPS]) await next(user, title)
    await next(user, "Tasks")
    expect(await screen.findByText(TASK_EXAMPLE)).toBeInTheDocument()
    expect(screen.getByRole("note", { name: "Example" })).toBeInTheDocument()

    await next(user, "Table or board")
    await next(user, "Who, how urgent, by when")
    await next(user, "Memory")
    expect(await screen.findByText(MEMORY_EXAMPLE)).toBeInTheDocument()
    expect(screen.getByRole("note", { name: "Example" })).toBeInTheDocument()
    expect(useTasks.getState().tasks.some((t) => t.title === TASK_EXAMPLE)).toBe(false)

    await next(user, "Approve or correct")
    await next(user, "Where it came from")
    await next(user, "Storage, Logs and Settings")
    expect(screen.queryByRole("note", { name: "Example" })).not.toBeInTheDocument()
    expect(useMemory.getState().entries.some((e) => e.text === MEMORY_EXAMPLE)).toBe(false)

    await user.keyboard("{Escape}")
    await user.click(navItem("Memory"))
    await screen.findByRole("heading", { level: 1, name: "Memory" })
    expect(screen.queryByText(MEMORY_EXAMPLE)).not.toBeInTheDocument()
  }, 20000)

  it("takes the examples away and reads the owner's memory again when Escape closes the tour", async () => {
    const read = vi.spyOn(platform, "memoryRead")
    const user = await startTour()
    for (const title of [...BEFORE_TASKS, ...SEARCH_STOPS, ...TASK_STOPS]) await next(user, title)
    await next(user, "Memory")
    expect(await screen.findByText(MEMORY_EXAMPLE)).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByText(MEMORY_EXAMPLE)).not.toBeInTheDocument()
    expect(screen.queryByRole("note", { name: "Example" })).not.toBeInTheDocument()
    expect(page("Memory")).toBeInTheDocument()
    await waitFor(() => expect(read).toHaveBeenCalled())
  }, 20000)

  it("fills Search with an example request and opens an example result, then gives the page back", async () => {
    const search = vi.spyOn(platform, "searchStore")
    const draft = vi.spyOn(platform, "searchDraft")
    const user = await startTour()
    for (const title of BEFORE_TASKS) await next(user, title)

    await next(user, "Search")
    expect((await screen.findAllByText(SEARCH_HIT)).length).toBeGreaterThan(0)
    expect(screen.getByRole("note", { name: "Example" })).toBeInTheDocument()

    await next(user, "Ask in your own words")
    const words = screen.getByRole("textbox", { name: "Describe what you're looking for" })
    expect(words).toHaveValue(SEARCH_ASK)
    expect(words.closest("[inert]")).not.toBeNull()

    await next(user, "Open a result")
    const opened = await screen.findByRole("button", { name: /^Hide the result:/ })
    expect(opened).toHaveAttribute("aria-expanded", "true")
    expect(await screen.findByRole("button", { name: "Show messages around it" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryAllByText(SEARCH_HIT)).toHaveLength(0))
    expect(screen.queryByRole("note", { name: "Example" })).not.toBeInTheDocument()
    expect(useSearch.getState()).toMatchObject({ demo: false, tool: null, query: "", answer: null })
    expect(search).not.toHaveBeenCalled()
    expect(draft).not.toHaveBeenCalled()
  }, 20000)

  it("points at the view switch and an example task's assignee, priority and due date", async () => {
    const user = await startTour()
    for (const title of [...BEFORE_TASKS, ...SEARCH_STOPS, "Tasks"]) await next(user, title)

    await next(user, "Table or board")
    const view = screen.getByRole("group", { name: "View" })
    expect(within(view).getByRole("radio", { name: "Table" })).toBeChecked()

    await next(user, "Who, how urgent, by when")
    const row = screen.getByRole("button", { name: "EX-3 Draft the launch announcement for 2 March" }).closest("li")
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText("for claude-code")).toBeInTheDocument()
    expect(within(row as HTMLElement).getAllByText("Medium").length).toBeGreaterThan(0)

    await next(user, "Memory")
    expect(screen.queryByText("Draft the launch announcement for 2 March")).not.toBeInTheDocument()
  }, 20000)

  it("shows an example memory's actions, then opens the messages it rests on", async () => {
    const sources = vi.spyOn(platform, "memorySources")
    const user = await startTour()
    for (const title of [...BEFORE_TASKS, ...SEARCH_STOPS, ...TASK_STOPS, "Memory"]) await next(user, title)

    await next(user, "Approve or correct")
    const row = screen.getByText(KAI).closest("[data-row]") as HTMLElement
    expect(within(row).getByRole("button", { name: "Approve" })).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Reject" })).toBeInTheDocument()
    expect(screen.queryByText(/What it rests on/)).not.toBeInTheDocument()

    await next(user, "Where it came from")
    expect(await screen.findByText(/What it rests on · 3 sources/)).toBeInTheDocument()
    expect(screen.getByText("“Fridays after lunch work best for me, mornings are packed.”")).toBeInTheDocument()

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Back" }))
    await screen.findByRole("dialog", { name: "Approve or correct" })
    await waitFor(() => expect(screen.queryByText(/What it rests on/)).not.toBeInTheDocument())

    await user.keyboard("{Escape}")
    expect(screen.queryByText(KAI)).not.toBeInTheDocument()
    expect(useMemory.getState().sources).toEqual({})
    expect(sources).not.toHaveBeenCalled()
  }, 20000)
})

describe("Help menu", () => {
  beforeEach(() => {
    localStorage.clear()
    useOnboarding.setState({ status: "done", open: false })
  })
  afterEach(() => vi.restoreAllMocks())

  it("opens WireCat's own documentation from its first item", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Help" }))

    const items = within(screen.getByRole("menu", { name: "Help" })).getAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual([
      "WireCat documentation",
      "Take the tour",
      "Show the welcome again",
      "Privacy",
      "About WireCat",
    ])
    await user.click(items[0] as HTMLElement)
    expect(open).toHaveBeenCalledWith("https://wirecat.dev/en/docs")
  })
})
