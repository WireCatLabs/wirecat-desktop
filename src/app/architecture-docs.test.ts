import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = join(__dirname, "..", "..")
const GUIDES = join(ROOT, "docs", "dev", "guides")
const DOCS = [
  join(ROOT, "CLAUDE.md"),
  join(ROOT, "docs", "dev", "ARCHITECTURE.md"),
  ...readdirSync(GUIDES)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(GUIDES, f)),
]
// Paths these docs name in another repository or in a build's output, not in this one.
const ELSEWHERE = new Set(["src/paths.ts", "src-tauri/target/debug/wirecat-desktop"])

const text = (path: string) => readFileSync(path, "utf8")

describe("the docs agents follow", () => {
  it("name every Rust module in ARCHITECTURE.md", () => {
    const arch = text(join(ROOT, "docs", "dev", "ARCHITECTURE.md"))
    const modules = readdirSync(join(ROOT, "src-tauri", "src")).filter((f) => f.endsWith(".rs") && f !== "main.rs")
    expect(modules.filter((m) => !arch.includes(m))).toEqual([])
  })

  it("point only at files that exist", () => {
    const missing = DOCS.flatMap((doc) => {
      const body = text(doc)
      const named = [...body.matchAll(/`((?:src|src-tauri|docs|scripts|bin|catalog)\/[^`\s*<>{}|…]+)`/g)]
        .map((m) => m[1] as string)
        .filter((p) => !ELSEWHERE.has(p))
        .map((p) => ({ shown: p, at: join(ROOT, p) }))
      const linked = [...body.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
        .map((m) => m[1] as string)
        .filter((p) => !/^[a-z]+:/.test(p))
        .map((p) => ({ shown: p, at: join(dirname(doc), p) }))
      return [...named, ...linked]
        .filter((p) => !existsSync(p.at))
        .map((p) => `${doc.slice(ROOT.length + 1)}: ${p.shown}`)
    })
    expect(missing).toEqual([])
  })
})
