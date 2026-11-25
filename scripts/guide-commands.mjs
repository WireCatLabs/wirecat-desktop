// Writes the command list the guides test and the catalog test check against: node scripts/guide-commands.mjs
// Each catalog tool's published release on npm, run through npx in a throwaway home: only `commands --json` and
// `--help`, with D-Bus off, so nothing reaches the keyring or a sign-in on this computer.
// `node scripts/guide-commands.mjs pbx@0.9.0` writes one tool at the version it names.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const out = "src/features/guides/commands.fixture.json"
const catalog = JSON.parse(readFileSync("catalog/tools.json", "utf8"))
const home = mkdtempSync(join(tmpdir(), "guide-commands-"))
const env = {
  ...process.env,
  HOME: home,
  XDG_CONFIG_HOME: join(home, "config"),
  XDG_DATA_HOME: join(home, "data"),
  XDG_STATE_HOME: join(home, "state"),
  XDG_CACHE_HOME: join(home, "cache"),
  npm_config_cache: join(process.env.HOME ?? home, ".npm"),
  DBUS_SESSION_BUS_ADDRESS: "disabled:",
}
const npm = (args) => execFileSync("npm", args, { encoding: "utf8" }).trim()
const run = (spec, bin, args) =>
  execFileSync("npx", ["-y", "-p", spec, bin, ...args], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })

const walk = (list) => list.flatMap((c) => [c, ...walk(c.commands ?? [])])
const flagsOf = (c) => (c.options ?? []).flatMap((o) => o.flags.split(/[,\s]+/).filter((f) => f.startsWith("--")))

const asked = Object.fromEntries(process.argv.slice(2).map((a) => a.split("@")))
// A helper (WireCat's Tailscale connection) has no `commands --json`, and the catalog runs none of its commands.
const tools = catalog.tools.filter((t) => !t.helper && (!process.argv[2] || asked[t.bin]))
const fixture = JSON.parse(readFileSync(out, "utf8"))
for (const { bin, package: pkg } of tools) {
  const spec = `${pkg}@${asked[bin] ?? npm(["view", pkg, "version"])}`
  const doc = JSON.parse(run(spec, bin, ["commands", "--json"]))
  const commands = walk(doc.commands)
    .map((c) => [...c.path, ...flagsOf(c).sort()].join(" "))
    .sort()
  const global = flagsOf({ options: doc.global_options ?? [] }).sort()
  fixture[bin] = {
    version: doc.version,
    profile: run(spec, bin, ["--help"]).includes(`Usage: ${bin} <profile> `),
    global,
    commands,
  }
  console.log(`${bin} ${doc.version}`)
}
const sorted = Object.fromEntries(catalog.tools.flatMap((t) => (fixture[t.bin] ? [[t.bin, fixture[t.bin]]] : [])))
writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`)
rmSync(home, { recursive: true, force: true })
console.log(`${out}: ${Object.keys(sorted).length} tools`)
