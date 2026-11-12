// The Tauri bundle must not carry the browser mock. Builds the way `tauri build` does (TAURI_ENV_PLATFORM set) into
// node_modules/.cache and fails when a string that only the mock contains is found in it, or when the first chunk
// grows past its budget.
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

// One from the community mock, one from the showcase's made-up chats.
const MOCK_ONLY = ["acme-cli", "Booked the flat in Alfama"]
// The first chunk was 301 kB gzipped on 2026-11-12; it carries all three languages and the tour's demo data.
const START_BUDGET_KB = 330
const out = join(import.meta.dirname, "..", "node_modules", ".cache", "bundle-check")
execFileSync("pnpm", ["exec", "vite", "build", "--outDir", out, "--emptyOutDir"], {
  stdio: "inherit",
  env: { ...process.env, TAURI_ENV_PLATFORM: "linux" },
})

const files = readdirSync(out, { recursive: true, withFileTypes: true })
  .filter((f) => f.isFile() && /\.(js|css|html)$/.test(f.name))
  .map((f) => join(f.parentPath, f.name))
const found = files.filter((f) => MOCK_ONLY.some((s) => readFileSync(f, "utf8").includes(s)))
if (found.length) {
  console.error(`The Tauri bundle contains the browser mock (${MOCK_ONLY.join(", ")}):\n${found.join("\n")}`)
  process.exit(1)
}

const start = files.filter((f) => /[\\/]start-[^\\/]*\.js$/.test(f))
if (start.length !== 1) {
  console.error(`Expected one start chunk, found ${start.length}:\n${start.join("\n")}`)
  process.exit(1)
}
const startKb = gzipSync(readFileSync(start[0])).length / 1000
if (startKb > START_BUDGET_KB) {
  console.error(
    `The start chunk is ${startKb.toFixed(1)} kB gzipped, over its ${START_BUDGET_KB} kB budget: ${start[0]}`,
  )
  process.exit(1)
}
console.log(
  `Tauri bundle is free of the mock (${files.length} files checked); start chunk ${startKb.toFixed(1)} kB gzipped.`,
)
