import { expect, it } from "vitest"
import { useSignIn } from "@/shared/signin-store"
import { type SyncRun, syncKey, useSync } from "./sync-store"

it("forgets a run that failed signed out once that account signs in again", () => {
  const key = syncKey("tg", "work")
  const failure = { message: "", code: "authentication_error", reason: null, run: null }
  useSync.setState({ runs: { [key]: { phase: "failed", startedAt: 1, endedAt: 2, failure } as SyncRun } })
  useSignIn.setState({ tool: "tg", profile: "work", phase: "scan" })
  useSignIn.setState({ phase: "done" })
  expect(useSync.getState().runs[key]).toBeUndefined()
})
