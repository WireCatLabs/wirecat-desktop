import { describe, expect, it } from "vitest"
import fixture from "@/features/guides/commands.fixture.json"
import raw from "../../catalog/tools.json"
import { isNewer } from "./status"

// The fixture is each tool's own `commands --json` at the version it names; `node scripts/guide-commands.mjs` refreshes it.
type Program = { version: string; global: string[]; commands: string[] }
const programs: Record<string, Program> = fixture

type Use = { where: string; bin: string; gate: string | null | undefined; words: string[] }

const isArgv = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((w) => typeof w === "string") &&
  (v[0] === "{profile}" || v.some((w) => w.startsWith("--")))

function usesOf(v: unknown, where: string, bin: string, gate: Use["gate"]): Use[] {
  if (isArgv(v)) return [{ where, bin, gate, words: v }]
  if (!v || typeof v !== "object") return []
  const own = Object.hasOwn(v, "minVersion") ? (v as { minVersion: string | null }).minVersion : gate
  return Object.entries(v).flatMap(([k, x]) => usesOf(x, `${where}.${k}`, bin, own))
}

const uses = raw.tools.flatMap((t) => (programs[t.bin] ? usesOf(t, t.id, t.bin, undefined) : []))

const parsed = (line: string) => {
  const words = line.split(" ")
  const flags = words.findIndex((w) => w.startsWith("--"))
  return { path: flags < 0 ? words : words.slice(0, flags), options: flags < 0 ? [] : words.slice(flags) }
}

/** The command a catalog line runs (the longest matching path) and the options of it the tool does not know. */
function check(use: Use) {
  const program = programs[use.bin] as Program
  const words = use.words.slice(use.words[0] === "{profile}" ? 1 : 0)
  const end = words.indexOf("--")
  const args = end < 0 ? words : words.slice(0, end)
  const positional = args.filter((w) => !w.startsWith("--") && !w.startsWith("{"))
  const command = program.commands
    .map(parsed)
    .filter((c) => c.path.every((p, i) => positional[i] === p))
    .sort((a, b) => b.path.length - a.path.length)[0]
  const unknown = args
    .map((w) => w.split("=")[0] ?? w)
    .filter((w) => w.startsWith("--") && w !== "--help")
    .filter((w) => !command?.options.includes(w) && !program.global.includes(w))
  const first = args.findIndex((w) => w.startsWith("--"))
  const lead = (first < 0 ? args : args.slice(0, first)).filter((w) => !w.startsWith("{"))
  return { command: command?.path.join(" "), whole: command?.path.length === lead.length, unknown }
}

const released = (use: Use) => !use.gate || !isNewer(use.gate, programs[use.bin]?.version ?? "0")

describe("catalog commands against the tools' own command lists", () => {
  it("reads enough of the catalog to mean something", () => {
    expect(uses.length).toBeGreaterThan(200)
  })

  it("runs only commands and options the tool has at the version it is enabled from", () => {
    const wrong = uses
      .filter((u) => u.gate !== null && released(u))
      .map((u) => ({ where: u.where, ...check(u) }))
      .filter((r) => !r.command || r.unknown.length > 0)
    expect(wrong).toEqual([])
  })

  it("enables a command once the tool has released it", () => {
    const waiting = uses
      .filter((u) => u.gate === null)
      .map((u) => ({ where: u.where, ...check(u) }))
      .filter((r) => r.whole && r.unknown.length === 0)
      .map((r) => r.where)
    expect(waiting).toEqual([])
  })
})
