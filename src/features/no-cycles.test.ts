import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, normalize, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "..")
const FEATURES = __dirname
const IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return /\.tsx?$/.test(e.name) && !e.name.includes(".test.") ? [path] : []
  })
}

const featureOf = (path: string) => {
  const [first] = relative(FEATURES, path).split(sep)
  return first?.includes(".") ? null : (first ?? null)
}

/** Feature folder -> the feature folders it imports, with one file that does it, for the message. */
function graph() {
  const edges = new Map<string, Map<string, string>>()
  for (const file of files(FEATURES)) {
    const from = featureOf(file)
    if (!from) continue
    for (const [, spec] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      if (!spec) continue
      const target = spec.startsWith("@/")
        ? join(SRC, spec.slice(2))
        : spec.startsWith(".")
          ? normalize(join(dirname(file), spec))
          : null
      const to = target?.startsWith(FEATURES + sep) ? featureOf(target) : null
      if (!to || to === from) continue
      const out = edges.get(from) ?? new Map<string, string>()
      if (!out.has(to)) out.set(to, relative(SRC, file))
      edges.set(from, out)
    }
  }
  return edges
}

/** Every cycle found by depth first search, as `a -> b -> a`. */
function cycles(edges: Map<string, Map<string, string>>) {
  const found: string[] = []
  const done = new Set<string>()
  const walk = (node: string, path: string[]) => {
    const at = path.indexOf(node)
    if (at >= 0) {
      const loop = path.slice(at).concat(node)
      found.push(
        loop.map((n, i) => (i < loop.length - 1 ? `${n} (${edges.get(n)?.get(loop[i + 1] ?? "")})` : n)).join(" -> "),
      )
      return
    }
    if (done.has(node)) return
    for (const next of edges.get(node)?.keys() ?? []) walk(next, [...path, node])
    done.add(node)
  }
  for (const node of edges.keys()) walk(node, [])
  return found
}

describe("feature folders", () => {
  it("import each other in one direction only", () => {
    expect(cycles(graph())).toEqual([])
  })

  it("finds a cycle when there is one", () => {
    const edge = (file: string) => new Map([["x", file]])
    const edges = new Map([
      ["a", new Map([["b", "a/File.ts"]])],
      ["b", edge("b/File.ts")],
      ["x", new Map([["a", "x/File.ts"]])],
    ])
    expect(cycles(edges)).toHaveLength(1)
  })
})
