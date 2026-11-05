import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { SyncEvent } from "@/platform/sync-schemas"
import { useNav } from "@/shared/nav"
import { useLogs } from "../logs/store"
import { SyncControl } from "./Sync"
import { useSync } from "./sync-store"

let send: (e: SyncEvent) => void = () => undefined
let finish: () => void = () => undefined

beforeEach(() => {
  vi.spyOn(platform, "syncLast").mockResolvedValue({
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
    left: null,
    known: true,
  })
  vi.spyOn(platform, "syncRun").mockImplementation((_id, _profile, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.spyOn(platform, "syncStop").mockImplementation(async () => send({ event: "stopped" }))
  const kept = ["20261027T121457Z-messages-sync-db4f0a", "20261103T091502Z-messages-sync-7c21e0"]
  vi.spyOn(platform, "listRuns").mockImplementation(async (id) => ({
    items:
      id === "tg"
        ? kept.map((run_id) => ({
            run_id,
            command: "messages sync",
            profile: "personal",
            status: "failed",
            started_at: new Date().toISOString(),
          }))
        : [],
    page: { has_more: false },
  }))
  vi.spyOn(platform, "showRun").mockImplementation(async (_id, run) => ({
    item: { run_id: run, command: "messages sync", status: "failed", started_at: new Date().toISOString(), events: [] },
  }))
})

afterEach(() => vi.restoreAllMocks())

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>

describe("syncing a profile from the Manage panel", () => {
  it("shows the last sync, the stage while it runs, and the result until dismissed", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    expect(await screen.findByText("Last synced 12 min ago")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Sync now" }))
    expect(platform.syncRun).toHaveBeenCalledWith("tg", "personal", expect.any(Function))
    send({ event: "stage", stage: "Fetching messages" })
    expect(screen.getByRole("progressbar", { name: "Syncing" })).toHaveAttribute("aria-valuetext", "Fetching messages")
    send({ event: "progress", chats: 40, chatsDone: 3, fetched: 1240 })
    expect(screen.getByRole("progressbar", { name: "Syncing" })).toHaveAttribute("aria-valuenow", "8")
    expect(screen.getByText("Chat 4 of 40 · 1,240 new messages")).toBeInTheDocument()
    send({ event: "done", summary: { new: 1240, places: 3, failed: 0, left: 0, complete: true } })
    finish()
    expect(await screen.findByText("Synced 1,240 new messages in 3 chats")).toBeInTheDocument()
    expect(screen.getByText("Your agents can search them now.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    await waitFor(() => expect(screen.queryByText(/Synced 1,240/)).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument()
  })

  it("stops the running sync and says what came in is kept", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Sync now" }))
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(platform.syncStop).toHaveBeenCalledWith("tg", "personal")
    expect(await screen.findByText("Stopped")).toBeInTheDocument()
    expect(screen.getByText(/What came in is kept/)).toBeInTheDocument()
  })

  it("does not start a second sync of the same profile", async () => {
    render(
      <>
        <SyncControl tool={tg} profile="personal" />
        <SyncControl tool={tg} profile="work" />
      </>,
    )
    await screen.findAllByText("Last synced 12 min ago")
    act(() => useSync.getState().start("tg", "personal"))
    act(() => useSync.getState().start("tg", "personal"))
    expect(platform.syncRun).toHaveBeenCalledTimes(1)
    const work = screen.getByRole("region", { name: "Sync Telegram work" })
    expect(within(work).getByRole("button", { name: "Sync now" })).toBeEnabled()
  })

  it("shows a failure as the tool's code and opens its failed run on Logs, never the tool's own words", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Sync now" }))
    send({
      event: "failed",
      message: "Telegram stopped with the error provider_error.",
      code: "provider_error",
      reason: null,
      run: "20261027T121457Z-messages-sync-db4f0a",
    })
    finish()
    expect(await screen.findByText("The sync failed")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Open the run on Logs" }))
    expect(useNav.getState().active).toBe("logs")
    await waitFor(() => expect(useLogs.getState().expanded).toBe("tg:20261027T121457Z-messages-sync-db4f0a"))
    expect(useLogs.getState().query).toBe("run_id:20261027T121457Z-messages-sync-db4f0a")
    expect(platform.showRun).toHaveBeenCalledWith("tg", "20261027T121457Z-messages-sync-db4f0a")
  })

  it("reads Logs again when the snapshot on screen predates the failed run", async () => {
    const run = "20261103T091502Z-messages-sync-7c21e0"
    vi.mocked(platform.listRuns).mockResolvedValueOnce({ items: [], page: { has_more: false } })
    await useLogs.getState().load()
    await useLogs.getState().openRun(run, 'command:"messages sync" status:failed')
    expect(useLogs.getState().query).toBe(`run_id:${run}`)
    expect(useLogs.getState().expanded).toBe(`tg:${run}`)
  })

  it("falls back to the tool's failed syncs when no tool kept the run", async () => {
    await useLogs.getState().openRun("20261103T091502Z-messages-sync-000000", 'command:"messages sync" status:failed')
    expect(useLogs.getState().query).toBe('command:"messages sync" status:failed')
    expect(useLogs.getState().expanded).toBeNull()
  })

  it("explains a rate limit with the wait the service asked for, and says WireCat does not retry", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Sync now" }))
    send({
      event: "failed",
      message: "Telegram stopped with the error rate_limited.",
      code: "rate_limited",
      reason: "provider.rate-limited",
      run: "20261103T091502Z-messages-sync-7c21e0",
      retryAfterMs: 25 * 60_000,
    })
    finish()
    expect(await screen.findByText("The service asked to slow down")).toBeInTheDocument()
    expect(screen.getByText(/^Telegram limits how fast history can be downloaded/)).toHaveTextContent(
      /It asked to wait 25 minutes: sync again after .+\. .* WireCat does not try again by itself\.$/,
    )
    expect(screen.getByRole("button", { name: "Open the run on Logs" })).toBeInTheDocument()
  })

  it("syncs mail per profile, apart from memo's one lock", () => {
    useSync.getState().start("memo", null)
    useSync.getState().start("email", "personal")
    useSync.getState().start("email", "work")
    expect(platform.syncRun).toHaveBeenCalledTimes(3)
  })
})
