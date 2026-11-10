import { expect, it } from "vitest"
import { taskFailure } from "./task-failure"

it("tells memo's refusals apart by their words, and calls the rest other", () => {
  expect(taskFailure("give --account — the stored accounts: --account telegram:1; --account email:[email]")).toBe(
    "account",
  )
  expect(taskFailure("only a project task moves on the board")).toBe("projectOnly")
  expect(taskFailure("--status, --agent, --revision, --project and --type are for a project task")).toBe("projectOnly")
  expect(taskFailure("database is locked")).toBe("busy")
  expect(taskFailure("memo timed out after 30 s")).toBe("timeout")
  expect(taskFailure("Memo is not installed")).toBe("missing")
  expect(taskFailure("no task Q-9")).toBe("other")
})
