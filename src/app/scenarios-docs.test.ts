import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = join(__dirname, "..", "..")
const SRC = join(ROOT, "src")
const READ = /(?:\bparams|\bquery|location\.search\))\.(?:get|has)\("([a-z][a-z0-9-]*)"\)/g

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [path] : []
  })
}

const namesIn = (paths: string[]) =>
  new Set(paths.flatMap((p) => [...readFileSync(p, "utf8").matchAll(READ)].map((m) => m[1] as string)))

const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8")
const start = claude.indexOf("Mock scenarios for the browser build")
const scenarios = claude.slice(start, claude.indexOf("\n## ", start))
const listed = new Set(
  [...scenarios.matchAll(/`[^`]*`/g)].flatMap(([span]) =>
    [...span.matchAll(/[?&]([a-z][a-z0-9-]*)(?=[=`&\s,)\]|])/g)].map((m) => m[1] as string),
  ),
)

describe("the mock scenarios in CLAUDE.md", () => {
  it("list every scenario the mock and app/scenarios.ts read", () => {
    const mocks = readdirSync(join(SRC, "platform"))
      .filter((f) => f.startsWith("mock") && f.endsWith(".ts") && !f.includes(".test."))
      .map((f) => join(SRC, "platform", f))
    const read = namesIn([...mocks, join(SRC, "app", "scenarios.ts")])
    expect([...read].filter((name) => !listed.has(name)).sort()).toEqual([])
  })

  it("list only scenarios something reads", () => {
    const read = namesIn(files(SRC))
    expect([...listed].filter((name) => !read.has(name)).sort()).toEqual([])
  })
})
