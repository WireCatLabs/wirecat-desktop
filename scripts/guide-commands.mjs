// Writes the command list the guides test checks every step against: node scripts/guide-commands.mjs
// Read from each installed tool's own `--help` and `commands --json`; with D-Bus off, nothing reaches the keyring.
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const TOOLS = ["tg", "max", "wa", "memo", "zm", "drive"]
const out = "src/features/guides/commands.fixture.json"
const env = { ...process.env, DBUS_SESSION_BUS_ADDRESS: "disabled:" }
const run = (bin, args) => execFileSync(bin, args, { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })

const walk = (list) => list.flatMap((c) => [c, ...walk(c.commands ?? [])])
const flagsOf = (c) => (c.options ?? []).flatMap((o) => o.flags.split(/[,\s]+/).filter((f) => f.startsWith("--")))

const fixture = {}
for (const bin of TOOLS) {
  const doc = JSON.parse(run(bin, ["commands", "--json"]))
  const commands = walk(doc.commands)
    .filter((c) => !c.commands?.length)
    .map((c) => [...c.path, ...flagsOf(c).sort()].join(" "))
    .sort()
  fixture[bin] = { version: doc.version, profile: run(bin, ["--help"]).includes(`Usage: ${bin} <profile> `), commands }
}
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`${out}: ${TOOLS.map((t) => `${t} ${fixture[t].version}`).join(", ")}`)
