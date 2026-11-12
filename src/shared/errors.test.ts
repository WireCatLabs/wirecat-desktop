import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { errorText } from "./errors"

const SRC = join(__dirname, "..")

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [path] : []
  })
}

describe("errorText", () => {
  it("reads a message from an Error or anything else", () => {
    expect(errorText(new Error("boom"))).toBe("boom")
    expect(errorText("plain")).toBe("plain")
  })

  it("is the only place that turns a failure into text (docs/dev/guides/reuse.md)", () => {
    const copies = files(SRC)
      .map((f) => relative(SRC, f))
      .filter((f) => f !== "shared/errors.ts")
      .filter((f) => /(\w+) instanceof Error \? \1\.message : String\(\1\)/.test(readFileSync(join(SRC, f), "utf8")))
    expect(copies).toEqual([])
  })
})
