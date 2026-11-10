import { waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { resetQueryClient } from "@/shared/query"
import { useTasks } from "./store"

const never = <T>() => new Promise<T>(() => {})

beforeEach(() => {
  resetQueryClient()
  useTasks.setState({ ...useTasks.getInitialState(), view: "table" }, true)
})
afterEach(() => vi.restoreAllMocks())

describe("the Tasks store", () => {
  it("names only the people on the page, and finds the owner once the page has its data", async () => {
    const named = vi.spyOn(platform, "peopleNamed")
    const search = vi.spyOn(platform, "peopleSearch")
    await useTasks.getState().load()
    await waitFor(() => expect(useTasks.getState().people.some((p) => p.owner)).toBe(true))
    const asked = named.mock.calls.flatMap(([refs]) => refs)
    expect(new Set(asked)).toEqual(new Set(useTasks.getState().assigned))
    expect(search.mock.calls).toEqual([[""]])
  })

  it("asks for names one call at a time", async () => {
    let open = 0
    let most = 0
    const named = vi.spyOn(platform, "peopleNamed").mockImplementation(async (refs) => {
      most = Math.max(most, ++open)
      await new Promise((r) => setTimeout(r, 200))
      open--
      return refs.map((ref) => ({ ref, name: `Name of ${ref}`, owner: false }))
    })
    const counts = await platform.taskCounts("")
    // The counts answer just before the list, so the two asks for names would overlap.
    vi.spyOn(platform, "taskCounts").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 300))
      return { ...counts, assignee: [{ value: "person:777", name: null, count: 1 }] }
    })
    await useTasks.getState().load()
    await waitFor(() => expect(named).toHaveBeenCalledTimes(2), { timeout: 2000 })
    await waitFor(() => expect(open).toBe(0), { timeout: 2000 })
    expect(most).toBe(1)
  })

  it("shows the counts and projects without waiting for any name", async () => {
    vi.spyOn(platform, "peopleNamed").mockImplementation(never)
    vi.spyOn(platform, "peopleSearch").mockImplementation(never)
    void useTasks.getState().load()
    await waitFor(() => {
      expect(useTasks.getState().counts).not.toBeNull()
      expect(useTasks.getState().projects.length).toBeGreaterThan(0)
    })
  })

  it("reads the projects once, not on every search", async () => {
    const projects = vi.spyOn(platform, "projectList")
    await useTasks.getState().load()
    await waitFor(() => expect(useTasks.getState().projectsAt).not.toBeNull())
    useTasks.getState().setQuery("state:todo")
    await waitFor(() => expect(useTasks.getState().reading).toBe(false))
    expect(projects).toHaveBeenCalledTimes(1)
  })

  it("opened again within a minute, the page reads nothing; later it reads with the rows still on screen", async () => {
    const list = vi.spyOn(platform, "taskList")
    await useTasks.getState().load()
    useTasks.getState().visit()
    expect(list).toHaveBeenCalledTimes(1)

    useTasks.setState({ readAt: Date.now() - 61_000 })
    const shown = useTasks.getState().tasks
    useTasks.getState().visit()
    expect(useTasks.getState().tasks).toBe(shown)
    expect(useTasks.getState().reading).toBe(true)
    expect(list).toHaveBeenCalledTimes(2)
  })
})
