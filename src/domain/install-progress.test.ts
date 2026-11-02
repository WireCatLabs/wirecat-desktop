import { describe, expect, it } from "vitest"
import { fraction, isProgressLine, type NpmProgress, readNpmLine, startProgress } from "./install-progress"

const lookup = (name: string) => `npm http fetch GET 200 https://registry.npmjs.org/${name} 120ms (cache miss)`
const url = (name: string) => `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`
const cache = (name: string) => `npm http cache ${name}@${url(name)} 0ms (cache hit)`
const fetch = (name: string) => `npm http fetch GET 200 ${url(name)} 300ms (cache miss)`

const read = (lines: string[], from: NpmProgress = startProgress()) =>
  lines.reduce((p, line) => readNpmLine(p, line), from)

describe("npm's progress from its http lines", () => {
  it("counts lookups, then downloads against the total its cache lines give", () => {
    const looked = read(["$ npm install --global @wirecat/tg-cli", lookup("a"), lookup("b"), lookup("c")])
    expect(looked).toMatchObject({ phase: "resolve", looked: 3, total: null })
    expect(fraction(looked)).toBe(0)

    const fetching = read([cache("a"), cache("b"), cache("c"), cache("d"), fetch("a")], looked)
    expect(fetching).toMatchObject({ phase: "fetch", total: 4, done: 1 })
    expect(fraction(fetching)).toBe(0.25)

    const landed = read([fetch("b"), fetch("c"), fetch("d")], fetching)
    expect(landed.phase).toBe("setup")
    expect(fraction(landed)).toBe(1)
  })

  it("counts unpacked packages without a total when the cache had them all", () => {
    const warm = read([lookup("a"), cache("a"), cache("b")])
    expect(warm).toMatchObject({ phase: "fetch", total: null, done: 2 })
    expect(fraction(warm)).toBe(0)
  })

  it("takes npm's own count from its last line", () => {
    const p = read([lookup("a"), cache("a"), "added 244 packages in 17s"])
    expect(p).toMatchObject({ phase: "setup", total: 244, done: 244 })
  })

  it("starts at an empty bar as soon as npm runs, before its first http line", () => {
    const p = read(["$ npm install --global @wirecat/tg-cli@latest --loglevel http"])
    expect(p).toMatchObject({ phase: "resolve", looked: 0 })
    expect(fraction(p)).toBe(0)
  })

  it("gives no bar to a manager that reports no progress", () => {
    const p = read(["$ pnpm add --global @wirecat/tg-cli@latest", "Progress: resolved 12, reused 0, downloaded 3"])
    expect(p.phase).toBeNull()
    expect(fraction(p)).toBeNull()
  })

  it("keeps only the http lines out of the readable log", () => {
    expect(isProgressLine(lookup("a"))).toBe(true)
    expect(isProgressLine(cache("a"))).toBe(true)
    expect(isProgressLine("npm error code EACCES")).toBe(false)
    expect(isProgressLine("npm http fetch GET 404 https://registry.npmjs.org/nope 80ms")).toBe(false)
    expect(isProgressLine("added 244 packages in 17s")).toBe(false)
  })
})
