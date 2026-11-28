import { expect, it } from "vitest"
import { taskFailure } from "./task-failure"

it("tells wcat's refusals apart by their words, and calls the rest other", () => {
  expect(taskFailure("give --account — the stored accounts: --account telegram:1; --account email:[email]")).toBe(
    "account",
  )
  expect(taskFailure("database is locked")).toBe("busy")
  expect(taskFailure("wcat timed out after 30 s")).toBe("timeout")
  expect(taskFailure("wcat is not installed")).toBe("missing")
  expect(taskFailure("no task Q-9")).toBe("other")
})
