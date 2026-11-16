import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  allowedLink,
  BLOCK_TYPES,
  classesOf,
  DISPLAY_CLASSES,
  INPUT_KINDS,
  inline,
  keptSecret,
  knownOf,
  markdown,
  nextOf,
  type Parsed,
  parseSetup,
  pathAnswers,
  problemsHere,
  roleOf,
  SETUP_LIMITS,
  type SetupDocument,
  textsOf,
  visibleFields,
} from "./setup-flow"
import oauth from "./setup-v1/oauth-or-token.json"
import pbx from "./setup-v1/pbx.json"
import schema from "./setup-v1/schema.json"
import source from "./setup-v1/source.json"
import tg from "./setup-v1/tg.json"

const flow = (parsed: Parsed): SetupDocument => {
  if (parsed.kind !== "flow") throw new Error(parsed.why)
  return parsed.document
}
const copy = <T>(value: T): T => structuredClone(value)

describe("cli-core's setup-v1 fixture", () => {
  // An edit here instead of in cli-core would let the two sides drift: change cli-core, copy the files byte for byte,
  // then record the commit and hashes in setup-v1/source.json.
  it.each(source.files.map(({ file, sha256 }) => [file, sha256]))(
    "%s is a byte-for-byte copy of cli-core's file",
    (file, sha) => {
      const bytes = readFileSync(join(__dirname, "setup-v1", file))
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha)
      expect(source.commit).toMatch(/^[0-9a-f]{40}$/)
    },
  )

  it("names the block types, input kinds and display classes this renderer knows", () => {
    const text = JSON.stringify(schema)
    const unknownType = text.match(/"not":\{"enum":(\[[^\]]+\])\}/)?.[1]
    expect(JSON.parse(unknownType ?? "[]")).toEqual([...BLOCK_TYPES])
    const kinds = text.match(/"input":\{"enum":(\[[^\]]+\])/)?.[1]
    expect(JSON.parse(kinds ?? "[]")).toEqual([...INPUT_KINDS])
    expect(Object.keys(DISPLAY_CLASSES)).toHaveLength(42)
  })

  it("draws the pbx example, the flow v1 builds", () => {
    const doc = flow(parseSetup(pbx))
    expect(Object.keys(doc.steps)).toEqual([
      "source",
      "sftp",
      "csv",
      "database",
      "recordings",
      "check",
      "check-failed",
      "done",
    ])
  })

  it.each([
    ["oauth-or-token", oauth, "oauth runs oauth"],
    ["tg", tg, "qr runs qr"],
  ])("leaves %s to the hand-made form: it runs an action of the tool's own", (_, doc, why) => {
    const parsed = parseSetup(doc)
    expect(parsed.kind).toBe("unsupported")
    expect(parsed.kind === "unsupported" && parsed.why).toContain(why)
  })

  it("reads every step of the examples, whatever they run", () => {
    for (const doc of [oauth, tg]) {
      const steps = copy(doc).steps as Record<string, { kind?: string; action?: string }>
      for (const step of Object.values(steps)) if (step.kind === "run") step.action = "apply"
      expect(parseSetup({ ...copy(doc), steps }).kind).toBe("flow")
    }
  })
})

describe("the walk through pbx's flow", () => {
  const doc = flow(parseSetup(pbx))
  const go = (from: string, answers: Record<string, unknown>, results = {}, path = ["source", from]) => {
    const step = doc.steps[from]
    return step ? nextOf(step, knownOf(doc, path, answers, results)) : undefined
  }

  it("branches on the answers and meets again at one shared step", () => {
    expect(go("source", { cdr_source: "csv", files_from: "local" })).toBe("csv")
    expect(go("source", { cdr_source: "mysql", files_from: "local" })).toBe("database")
    expect(go("source", { cdr_source: "csv", files_from: "sftp" })).toBe("sftp")
    expect(go("sftp", { cdr_source: "csv" })).toBe("csv")
    expect(go("csv", {})).toBe("recordings")
    expect(go("database", {})).toBe("recordings")
  })

  it("follows the check's result", () => {
    expect(go("check", {}, { check: { outcome: "ok" } })).toBe("done")
    expect(go("check", {}, { check: { outcome: "error", code: "authentication_error" } })).toBe("database")
    expect(go("check", {}, { check: { outcome: "error", code: "network_error" } })).toBe("check-failed")
  })

  it("sends only the inputs shown on the steps visited", () => {
    const answers = { cdr_source: "mysql", files_from: "local", sftp_host: "left.example", db_host: "pbx.local" }
    const secrets = new Map([
      ["ssh", "never-sent"],
      ["db", "s3cret"],
    ])
    const sent = pathAnswers(doc, ["source", "database"], { ...answers, db_port: "3306" }, secrets)
    expect(sent).toEqual({
      cdr_source: "mysql",
      files_from: "local",
      db_host: "pbx.local",
      db_port: 3306,
      db: "s3cret",
    })
  })

  it("leaves an empty secret out, so the CLI keeps the stored one", () => {
    const sent = pathAnswers(doc, ["source", "database"], { cdr_source: "mysql", files_from: "local" }, new Map())
    expect(sent).not.toHaveProperty("db")
  })

  it("hides an input whose condition fails", () => {
    const csv = doc.steps.csv
    const path = ["source", "csv"]
    const local = visibleFields(csv?.blocks, knownOf(doc, path, { files_from: "local" })).map((f) => f.id)
    const remote = visibleFields(csv?.blocks, knownOf(doc, path, { files_from: "sftp" })).map((f) => f.id)
    expect(local).toEqual(["cdr_csv_path"])
    expect(remote).toEqual(["cdr_csv_path_remote"])
  })

  it("reads a profile's current value for a condition when nothing was typed", () => {
    const editing = { ...doc, values: { cdr_source: "csv", files_from: "local" } }
    expect(nextOf(editing.steps.source as never, knownOf(editing, ["source"], {}))).toBe("csv")
  })

  it("reads in a condition only the answers on the path walked, as the CLI does", () => {
    const answers = { cdr_source: "csv", files_from: "local", cdr_csv_path: "/var/log/Master.csv" }
    const left = knownOf(doc, ["source", "database", "recordings"], { ...answers, cdr_source: "mysql" })
    expect(left.field("cdr_csv_path")).toBeUndefined()
    expect(left.field("cdr_source")).toBe("mysql")
    expect(knownOf(doc, ["source", "csv"], answers).field("cdr_csv_path")).toBe("/var/log/Master.csv")
  })

  it("does not read a profile's value of a field the path has not reached", () => {
    const editing = { ...doc, values: { db_host: "old.host" } }
    expect(knownOf(editing, ["source"], {}).field("db_host")).toBeUndefined()
    expect(knownOf(editing, ["source", "database"], { cdr_source: "mysql" }).field("db_host")).toBe("old.host")
  })

  it("shows a dry run's problems only for the step on screen", () => {
    const fields = visibleFields(
      doc.steps.database?.blocks,
      knownOf(doc, ["source", "database"], { cdr_source: "mysql" }),
    )
    const run = {
      valid: false,
      at: "database",
      errors: [
        { input: "db_host", setting: "db_host", message: "is needed" },
        { input: "phone_region", setting: "phone_region", message: "is needed" },
      ],
    }
    expect(problemsHere(run, fields)).toEqual({ db_host: "is needed" })
  })
})

describe("texts", () => {
  const doc = flow(parseSetup(pbx))
  it("are in the app's language, English where it lacks one", () => {
    expect(textsOf(doc, "ru")("source.title")).toBe("Где записи о звонках?")
    expect(textsOf(doc, "ru")("source.intro")).toBe(doc.texts.en["source.intro"])
    expect(textsOf(doc, "es")("source.title")).toBe("Where are the call records?")
  })
  it("fill their placeholders from the block's params", () => {
    const own = { ...doc, texts: { en: { "a.b": "Such as {example}, not {other}." } } }
    expect(textsOf(own, "en")("a.b", { example: "pbx.local" })).toBe("Such as pbx.local, not {other}.")
  })
})

describe("the security rules", () => {
  it("ignores a class outside the reserved names and never passes it on", () => {
    expect(classesOf(["w-full", "fixed", "inset-0", "bg-red-500", "z-50", "center"])).toBe(
      "w-full self-center text-center",
    )
    expect(classesOf(["toString", "constructor", "__proto__"])).toBe("")
  })

  it("draws an unknown role as the default", () => {
    expect(roleOf("note", "warning")).toBe("warning")
    expect(roleOf("note", "system-dialog")).toBeUndefined()
    expect(roleOf("link", "card")).toBeUndefined()
  })

  it("lets only https links to WireCat and the tool's own domains through", () => {
    expect(allowedLink("https://wirecat.dev/ru/docs/pbx/troubleshooting")).toBe(
      "https://wirecat.dev/ru/docs/pbx/troubleshooting",
    )
    expect(allowedLink("https://github.com/WireCatLabs/asterisk-cli")).not.toBeNull()
    expect(allowedLink("https://acme.bitrix24.ru/x", ["bitrix24.ru"])).not.toBeNull()
    for (const refused of [
      "http://wirecat.dev/",
      "javascript:alert(1)",
      "data:text/html,<b>",
      "file:///etc/passwd",
      "https://wirecat.dev.evil.example/",
      "https://evilwirecat.dev/",
      "https://github.com/someone-else/repo",
      "https://user:pass@wirecat.dev/",
      "https://wirecat.dev:8443/",
      "https://example.com/",
    ])
      expect(allowedLink(refused), refused).toBeNull()
  })

  it("keeps raw HTML and images in Markdown as text", () => {
    expect(inline("<img src=x onerror=alert(1)> and <b>bold</b>")).toEqual([
      { t: "text", v: "<img src=x onerror=alert(1)> and <b>bold</b>" },
    ])
    expect(inline("![logo](https://wirecat.dev/a.png)")).toEqual([
      { t: "text", v: "![logo](https://wirecat.dev/a.png)" },
    ])
  })

  it("refuses a document over the limits or with an operator it does not know", () => {
    const deep = copy(pbx) as typeof pbx & { steps: Record<string, unknown> }
    let group: unknown = { type: "text", text: "source.intro" }
    for (let i = 0; i < 9; i++) group = { type: "group", blocks: [group] }
    ;(deep.steps.source as { blocks: unknown[] }).blocks.push(group)
    expect(parseSetup(deep)).toMatchObject({ kind: "unsupported", why: "groups nest too deep" })

    const many = copy(pbx) as { steps: Record<string, unknown> }
    for (let i = 0; i < 60; i++) many.steps[`extra-${i}`] = { kind: "done", title: "done.title" }
    expect(parseSetup(many)).toMatchObject({ kind: "unsupported" })

    const operator = copy(pbx) as { steps: { source: { next: unknown[] } } }
    operator.steps.source.next.unshift({ when: { field: "cdr_source", matches: ".*" }, to: "csv" })
    expect(parseSetup(operator).kind).toBe("unsupported")

    expect(parseSetup({ ...copy(pbx), requires: ["input.countries", "run", "options_from"] })).toMatchObject({
      kind: "unsupported",
      why: "requires options_from",
    })
    expect(parseSetup({ ...copy(pbx), version: 2 }).kind).toBe("unsupported")
  })

  it("finds no step, text, value or answer by a name every object has", () => {
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const start = { ...copy(pbx), start: name }
      expect(parseSetup(start).kind, name).toBe("unsupported")
      const next = copy(pbx) as { steps: { csv: { next: unknown } } }
      next.steps.csv.next = name
      expect(parseSetup(next).kind, name).toBe("unsupported")
      const doc = flow(parseSetup(pbx))
      expect(textsOf(doc, "ru")(name)).toBe(name)
      expect(textsOf(doc, name)("source.title")).toBe("Where are the call records?")
    }
    const titled = copy(pbx) as { steps: { source: { title: string } } }
    titled.steps.source.title = "constructor"
    expect(textsOf(flow(parseSetup(titled)), "en")("constructor")).toBe("constructor")
    const field = { type: "input", id: "constructor", input: "text", label: "x", secret: "constructor" } as never
    expect(keptSecret(field, {})).toBe(false)
    const own = copy(pbx) as { steps: { source: { blocks: unknown[] } } }
    own.steps.source.blocks.push(field)
    expect(knownOf(flow(parseSetup(own)), ["source"], {}).field("constructor")).toBeUndefined()
  })

  it("measures the 256 KB limit on the document as the tool sent it", () => {
    const big = copy(pbx) as { steps: { source: Record<string, unknown> } }
    big.steps.source.padding = "x".repeat(SETUP_LIMITS.bytes)
    expect(parseSetup(big)).toMatchObject({ kind: "unsupported", why: "the document is over 256 KB" })
  })

  it("draws a block type from a newer format as its fallback", () => {
    const newer = copy(pbx) as { steps: { source: { blocks: unknown[] } } }
    newer.steps.source.blocks.push({ type: "diagram", fallback: "source.intro", nodes: [] })
    const doc = flow(parseSetup(newer))
    expect(doc.steps.source?.blocks?.at(-1)).toEqual({ type: "unknown", fallback: "source.intro" })
  })

  it("drops keys it does not draw, such as each setting's JSON Schema", () => {
    const shown = copy(pbx) as { steps: { database: { blocks: Record<string, unknown>[] } } }
    const host = shown.steps.database.blocks[2]?.blocks as Record<string, unknown>[]
    if (host[0]) host[0].schema = { type: "string", minLength: 1 }
    const doc = flow(parseSetup(shown))
    expect(JSON.stringify(doc)).not.toContain("minLength")
  })
})

describe("Markdown", () => {
  it("reads paragraphs, lists and inline marks", () => {
    expect(markdown("Run once:\n\n- `pbx models download`\n- **then** *sync*\n\n### Next")).toEqual([
      { t: "p", c: [{ t: "text", v: "Run once:" }] },
      {
        t: "ul",
        items: [
          [{ t: "code", v: "pbx models download" }],
          [
            { t: "strong", c: [{ t: "text", v: "then" }] },
            { t: "text", v: " " },
            { t: "em", c: [{ t: "text", v: "sync" }] },
          ],
        ],
      },
      { t: "h", c: [{ t: "text", v: "Next" }] },
    ])
    expect(inline("[help](https://wirecat.dev/x)")).toEqual([
      { t: "link", href: "https://wirecat.dev/x", c: [{ t: "text", v: "help" }] },
    ])
  })
})
