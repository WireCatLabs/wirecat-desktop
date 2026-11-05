// The Tauri bundle must not carry the browser mock. Builds the way `tauri build` does (TAURI_ENV_PLATFORM set) into
// node_modules/.cache and fails when a string that only the mock contains is found in it.
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const MOCK_ONLY = ["acme-cli"]
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
console.log(`Tauri bundle is free of the mock (${files.length} files checked).`)
