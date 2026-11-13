import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "..")

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [path] : []
  })
}

describe("a focused text field shows one outline (owner, 2026-11-13)", () => {
  it("drops the global ring on every text field and turns its own border purple instead", () => {
    const css = readFileSync(join(SRC, "styles/index.css"), "utf8")
    const field = ':is(input:not([type="checkbox"], [type="radio"], [type="range"]), textarea, select):focus-visible'
    expect(css).toContain(`${field} {\n  outline: none;\n}`)
    expect(css).toMatch(/:focus-visible:not\(\s*\[aria-invalid="true"\]\s*\) \{\n {2}border-color: var\(--brand\);/)
  })

  it("draws no ring of its own on a bordered field, which would bring the second outline back", () => {
    const ringed =
      /"[^"\n]*border-line-strong[^"\n]*bg-app(?![\w-])[^"\n]*(?<![\w-])focus(-visible)?:(outline-\d|ring-\d)[^"\n]*"/
    const found = files(SRC)
      .map((f) => relative(SRC, f))
      .filter((f) => ringed.test(readFileSync(join(SRC, f), "utf8")))
    expect(found).toEqual([])
  })
})
