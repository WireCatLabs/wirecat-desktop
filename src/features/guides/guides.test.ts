import { describe, expect, it } from "vitest"
import { providerOf } from "@/domain/archive"
import { LANGS } from "@/i18n"
import fixture from "./commands.fixture.json"
import { fill, GUIDES, variesByMessenger } from "./guides"

const MESSENGERS = ["tg", "max", "wa"]

type Program = { profile: boolean; commands: { path: string; options: Set<string> }[] }

const programs = new Map<string, Program>(
  Object.entries(fixture).map(([bin, t]) => [
    bin,
    {
      profile: t.profile,
      commands: t.commands.map((line) => {
        const words = line.split(" ")
        const flags = words.findIndex((w) => w.startsWith("--"))
        return {
          path: (flags < 0 ? words : words.slice(0, flags)).join(" "),
          options: new Set(flags < 0 ? [] : words.slice(flags)),
        }
      }),
    },
  ]),
)

const words = (run: string) => run.match(/"[^"]*"|'[^']*'|\S+/g) ?? []

/** What is wrong with a step's command line for the installed tools, or null when every word is the tool's own. */
function problemOf(run: string): string | null {
  const [bin = "", ...rest] = words(run)
  const program = programs.get(bin)
  if (!program) return `${bin} is not a known program`
  if (program.profile !== (rest[0] === "<profile>"))
    return program.profile ? "the profile must stay <profile> for the agent" : `${bin} takes no profile`
  const args = program.profile ? rest.slice(1) : rest
  const line = ` ${args.join(" ")} `
  const command = program.commands
    .filter((c) => line.startsWith(` ${c.path} `))
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (!command) return `${bin} has no command ${args.slice(0, 3).join(" ")}`
  const unknown = args.filter((w) => w.startsWith("--") && !command.options.has(w))
  return unknown.length ? `${bin} ${command.path} has no ${unknown.join(", ")}` : null
}

const runsFor = (messenger: string | null) => (g: (typeof GUIDES)[number]) => g.steps.map((s) => fill(s.run, messenger))

describe("every step names a real command", () => {
  for (const g of GUIDES) {
    const targets = variesByMessenger(g) ? (g.needs.any ?? []) : [null]
    for (const messenger of targets)
      it(`${g.id}${messenger ? ` for ${messenger}` : ""}`, () => {
        expect(runsFor(messenger)(g).map((run) => [run, problemOf(run)])).toEqual(
          runsFor(messenger)(g).map((run) => [run, null]),
        )
      })
  }
})

it("leaves a messenger out of a guide only when one of its steps has no command there", () => {
  for (const g of GUIDES.filter(variesByMessenger))
    for (const messenger of MESSENGERS.filter((id) => !g.needs.any?.includes(id)))
      expect(
        runsFor(messenger)(g).some((run) => problemOf(run) !== null),
        `${g.id} for ${messenger}`,
      ).toBe(true)
})

it("catches a typo in a command or an option", () => {
  expect(problemOf("tg <profile> inbx date>18h")).toBe("tg has no command inbx date>18h")
  expect(problemOf("wa <profile> review --unanswred")).toBe("wa review has no --unanswred")
  expect(problemOf("tg personal inbox")).toBe("the profile must stay <profile> for the agent")
  expect(problemOf("tg inbox")).toBe("the profile must stay <profile> for the agent")
  expect(problemOf("memo <profile> tasks list")).toBe("memo takes no profile")
})

it("names no other messenger once a guide is filled for one", () => {
  const marks = (id: string) => [`${id} CLI`, `${id} <profile>`, `msg:${providerOf(id)}/`, `${providerOf(id)}:…`]
  for (const g of GUIDES.filter(variesByMessenger))
    for (const messenger of g.needs.any ?? []) {
      const text = [...LANGS.map((l) => g.prompt[l]), ...g.steps.map((s) => s.run)].map((t) => fill(t, messenger))
      const others = MESSENGERS.filter((id) => id !== messenger).flatMap(marks)
      for (const t of text) {
        expect(
          others.filter((mark) => t.includes(mark)),
          `${g.id} for ${messenger}: ${t}`,
        ).toEqual([])
        expect(t).not.toMatch(/\{(?:cli|provider)\}/)
      }
    }
})
