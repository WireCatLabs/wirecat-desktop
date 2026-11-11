import { expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useSignIn } from "@/shared/signin-store"
import { READS_AT_ONCE, type SyncRun, syncKey, useSync } from "./sync-store"

it("forgets a run that failed signed out once that account signs in again", () => {
  const key = syncKey("tg", "work")
  const failure = { message: "", code: "authentication_error", reason: null, run: null }
  useSync.setState({ runs: { [key]: { phase: "failed", startedAt: 1, endedAt: 2, failure } as SyncRun } })
  useSignIn.setState({ tool: "tg", profile: "work", phase: "scan" })
  useSignIn.setState({ phase: "done" })
  expect(useSync.getState().runs[key]).toBeUndefined()
})

it("reads every profile's last sync at once, a few processes at a time", async () => {
  let inFlight = 0
  let peak = 0
  const answers: (() => void)[] = []
  vi.spyOn(platform, "syncLast").mockImplementation(() => {
    inFlight++
    peak = Math.max(peak, inFlight)
    return new Promise((resolve) =>
      answers.push(() => {
        inFlight--
        resolve({ at: null, left: null, known: true })
      }),
    )
  })
  const profiles = ["test", "test2", "ya", "work", "home"]
  const loads = profiles.map((p) => useSync.getState().loadLast("tg", p))
  await vi.waitFor(() => expect(inFlight).toBe(READS_AT_ONCE))
  while (answers.length > 0) {
    answers.shift()?.()
    await new Promise((r) => setTimeout(r, 0))
  }
  await Promise.all(loads)
  expect(peak).toBe(READS_AT_ONCE)
  expect(Object.keys(useSync.getState().last)).toEqual(expect.arrayContaining(profiles.map((p) => syncKey("tg", p))))
})
