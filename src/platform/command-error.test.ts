import { describe, expect, it } from "vitest"
import { CommandError, commandError } from "./command-error"

describe("commandError", () => {
  it("turns a Rust error into an Error whose text is the command's message", () => {
    const e = commandError({ kind: "unknown_tool", message: "unknown tool: zz" })
    expect(e).toBeInstanceOf(CommandError)
    expect((e as CommandError).kind).toBe("unknown_tool")
    expect((e as Error).message).toBe("unknown tool: zz")
    expect(String(e)).toBe("unknown tool: zz")
  })

  it("leaves anything else as it came", () => {
    const failure = { reason: "offline", detail: "dns error" }
    expect(commandError(failure)).toBe(failure)
    expect(commandError("plain text")).toBe("plain text")
  })
})
