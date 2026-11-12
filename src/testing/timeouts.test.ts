import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "..")

function tests(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return tests(path)
    return /\.test\.tsx?$/.test(e.name) && path !== __filename ? [path] : []
  })
}

/** The waits docs/dev/guides/testing.md allows: the app's own pause from MOTION, or a page made slow on purpose. */
const ALLOWED = [
  "app/TourSlowPage.test.tsx: timeout: LOAD_MS + 3000",
  "app/TourSlowPage.test.tsx: }, 20000)",
  "features/signin/SignInDialog.test.tsx: timeout: MOTION.hold + MOTION.swap + 1000",
  "features/onboarding/install.test.tsx: timeout: MOTION.hold + MOTION.slow + 1000",
]

describe("tests wait no longer than the defaults (docs/dev/guides/testing.md)", () => {
  it("sets a timeout of its own only where the guide allows one", () => {
    const own = tests(SRC).flatMap((path) => {
      const file = relative(SRC, path)
      const text = readFileSync(path, "utf8")
      const set = [...text.matchAll(/\b(?:test|hook)?[tT]imeout:[^,})]*|^\s*\},\s*[\d_]+\)/gm)].map((m) => m[0].trim())
      return set.map((s) => `${file}: ${s}`).filter((s) => !ALLOWED.includes(s))
    })
    expect(own).toEqual([])
  })
})
