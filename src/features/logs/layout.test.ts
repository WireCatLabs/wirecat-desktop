import { readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

const source = (name: string) => readFileSync(join(__dirname, name), "utf8")
const rem = (text: string, pattern: RegExp) => Number(pattern.exec(text)?.[1] ?? Number.NaN)

it("shows the filter column only at a width where the runs table fits beside it", () => {
  const page = source("LogsPage.tsx")
  const table = rem(source("RunsTable.tsx"), /<table className="[^"]*\bmin-w-\[([\d.]+)rem\]/)
  const from = rem(page, /@min-\[([\d.]+)rem\]:grid-cols-\[/)
  const column = rem(page, /:grid-cols-\[([\d.]+)rem_/)
  const gap = rem(page, /grid gap-\[([\d.]+)rem\] @min-/)
  expect(page).toContain('<Page className="@container">')
  expect(page).not.toMatch(/\b(lg|xl):(grid-cols|block|flex|hidden)/)
  expect(from).toBeGreaterThanOrEqual(column + gap + table)
})
