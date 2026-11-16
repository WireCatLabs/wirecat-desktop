// A tool's connection flow as its CLI describes it (`<tool> <profile> setup show --json`, the WireCat setup format v1).
// The document comes from an installed npm package, so nothing in it is trusted: this parser keeps only what the
// renderer knows how to draw, and the renderer runs no command, loads no file and applies no style from it. The
// contract is cli-core's `test/fixtures/setup-v1/`, copied byte for byte into `setup-v1/` (commit and hashes in
// `setup-v1/source.json`, checked by `setup-flow.test.ts`).
import * as v from "valibot"

export const SETUP_LIMITS = { bytes: 256 * 1024, steps: 60, depth: 8, transitions: 100 } as const

const PATTERNS = {
  step: /^[a-z][a-z0-9-]{0,47}$/,
  input: /^[a-z][a-z0-9_-]{0,47}$/,
  text: /^[a-z][a-z0-9_.-]{0,95}$/,
  action: /^[a-z][a-z0-9-]{0,31}$/,
  setting: /^[a-z][a-z0-9_]{0,63}$/,
  secret: /^[a-z0-9][a-z0-9-]{0,31}$/,
  feature: /^[a-z][a-z0-9_./-]{0,63}$/,
  name: /^[a-z][a-z0-9/-]{0,31}$/,
  param: /^[a-z][a-z0-9_]{0,31}$/,
  language: /^[a-z]{2}(-[A-Z]{2})?$/,
  error: /^[a-z][a-z0-9_]{0,63}$/,
}

export const BLOCK_TYPES = [
  "text",
  "heading",
  "note",
  "image",
  "code",
  "input",
  "choice",
  "group",
  "link",
  "requirement",
  "divider",
] as const

export const INPUT_KINDS = [
  "text",
  "number",
  "port",
  "toggle",
  "password",
  "file",
  "folder",
  "select",
  "multiselect",
  "countries",
  "timezone",
] as const

/**
 * The reserved display classes, each mapped to Desktop's own design tokens (NEED-2666). A name outside this map is
 * ignored and never reaches CSS, so a tool can size a block inside the flow but never touch the window around it.
 * Every value is a literal: Tailwind generates only the classes it finds written in the source.
 */
export const DISPLAY_CLASSES: Readonly<Record<string, string>> = {
  "w-auto": "w-auto",
  "w-1/3": "w-full sm:w-1/3",
  "w-1/2": "w-full sm:w-1/2",
  "w-2/3": "w-full sm:w-2/3",
  "w-full": "w-full",
  "w-narrow": "max-w-[34rem]",
  "h-sm": "max-h-24",
  "h-md": "max-h-48",
  "h-lg": "max-h-80",
  "h-xl": "max-h-[32rem]",
  "grow-1": "min-w-0 flex-[1_1_0%]",
  "grow-2": "min-w-0 flex-[2_1_0%]",
  "grow-3": "min-w-0 flex-[3_1_0%]",
  "grow-4": "min-w-0 flex-[4_1_0%]",
  "mt-none": "mt-0",
  "mt-sm": "mt-1",
  "mt-md": "mt-3",
  "mt-lg": "mt-6",
  "mb-none": "mb-0",
  "mb-sm": "mb-1",
  "mb-md": "mb-3",
  "mb-lg": "mb-6",
  "gap-sm": "gap-2",
  "gap-md": "gap-4",
  "gap-lg": "gap-6",
  start: "self-start text-left",
  center: "self-center text-center",
  end: "self-end text-right",
  "text-sm": "text-[0.9rem]",
  "text-lg": "text-[1.15rem]",
  muted: "text-ink-soft",
  strong: "font-semibold",
  mono: "font-mono",
  raised: "rounded-rack bg-app-2 p-3 shadow-panel",
  outlined: "rounded-rack border border-line-strong p-3",
  accent: "rounded-rack bg-brand-soft p-3",
  first: "max-sm:order-first",
  last: "max-sm:order-last",
  "hide-narrow": "max-sm:hidden",
  "hide-wide": "sm:hidden",
  "cols-2": "grid sm:grid-cols-2",
  "cols-3": "grid sm:grid-cols-3",
}

/** Desktop's classes for a block's reserved names; anything else is dropped. */
export const classesOf = (names: readonly string[] | undefined): string =>
  (names ?? [])
    .filter((name) => Object.hasOwn(DISPLAY_CLASSES, name))
    .map((name) => DISPLAY_CLASSES[name])
    .join(" ")

const ROLES: Partial<Record<string, readonly string[]>> = {
  note: ["tip", "info", "warning", "danger", "success"],
  group: ["card", "details", "row"],
  link: ["button", "inline"],
}

/** A role Desktop does not know is drawn as the type's default. */
export const roleOf = (type: string, role: string | undefined): string | undefined =>
  role !== undefined && ROLES[type]?.includes(role) ? role : undefined

const id = (pattern: RegExp) => v.pipe(v.string(), v.regex(pattern))
const textId = id(PATTERNS.text)

export type Condition =
  | { field: string; is: string | number | boolean }
  | { field: string; in: (string | number)[] }
  | { field: string; set: boolean }
  | { result: string; is: "ok" }
  | { result: string; error: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }

// Conditions alone are strict: an unknown operator would otherwise read as a condition that always holds.
const ConditionSchema: v.GenericSchema<Condition> = v.lazy(() =>
  v.union([
    v.strictObject({ field: id(PATTERNS.input), is: v.union([v.string(), v.number(), v.boolean()]) }),
    v.strictObject({ field: id(PATTERNS.input), in: v.array(v.union([v.string(), v.number()])) }),
    v.strictObject({ field: id(PATTERNS.input), set: v.boolean() }),
    v.strictObject({ result: id(PATTERNS.step), is: v.literal("ok") }),
    v.strictObject({ result: id(PATTERNS.step), error: id(PATTERNS.error) }),
    v.strictObject({ all: v.array(ConditionSchema) }),
    v.strictObject({ any: v.array(ConditionSchema) }),
    v.strictObject({ not: ConditionSchema }),
  ]),
) as v.GenericSchema<Condition>

const params = v.optional(v.record(id(PATTERNS.param), v.pipe(v.string(), v.maxLength(200))))
const base = {
  id: v.optional(id(PATTERNS.input)),
  when: v.optional(ConditionSchema),
  role: v.optional(id(PATTERNS.name)),
  class: v.optional(v.array(id(PATTERNS.name))),
  fallback: v.optional(textId),
}
const OptionSchema = v.object({
  value: v.string(),
  label: textId,
  hint: v.optional(textId),
  icon: v.optional(id(PATTERNS.name)),
})
export type Value = string | number | boolean | string[]
const ValueSchema = v.union([v.string(), v.number(), v.boolean(), v.array(v.string())])

const InputSchema = v.object({
  ...base,
  type: v.literal("input"),
  id: id(PATTERNS.input),
  setting: v.optional(id(PATTERNS.setting)),
  secret: v.optional(id(PATTERNS.secret)),
  input: v.picklist(INPUT_KINDS),
  label: textId,
  hint: v.optional(textId),
  placeholder: v.optional(textId),
  optional: v.optional(v.boolean()),
  default: v.optional(ValueSchema),
  multiline: v.optional(v.boolean()),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
  accept: v.optional(v.array(v.pipe(v.string(), v.regex(/^\.[a-z0-9]{1,10}$/)))),
  options: v.optional(v.array(OptionSchema)),
  options_from: v.optional(id(PATTERNS.action)),
})
export type InputBlock = v.InferOutput<typeof InputSchema>

const ChoiceSchema = v.object({
  ...base,
  type: v.literal("choice"),
  id: id(PATTERNS.input),
  setting: v.optional(id(PATTERNS.setting)),
  label: v.optional(textId),
  hint: v.optional(textId),
  options: v.pipe(v.array(OptionSchema), v.minLength(1)),
  optional: v.optional(v.boolean()),
  default: v.optional(v.string()),
})
export type ChoiceBlock = v.InferOutput<typeof ChoiceSchema>
export type Field = InputBlock | ChoiceBlock

type Common = { id?: string; when?: Condition; role?: string; class?: string[]; fallback?: string }
export type Block = Common &
  (
    | { type: "text" | "heading" | "note"; text: string; level?: number; params?: Record<string, string> }
    | { type: "image"; asset: string; alt: string; caption?: string }
    | { type: "code"; code: string; copy?: boolean; language?: string }
    | Omit<InputBlock, keyof Common>
    | Omit<ChoiceBlock, keyof Common>
    | { type: "group"; blocks: Block[]; title?: string }
    | { type: "link"; href: string; text: string }
    | { type: "requirement"; check: string; text: string; fix?: string }
    | { type: "divider" }
    /** A type of a newer format: drawn as its `fallback` text, or not at all. */
    | { type: "unknown" }
  )

const KNOWN = new Set<string>(BLOCK_TYPES)

const BlockSchema: v.GenericSchema<unknown, Block> = v.lazy(() =>
  v.union([
    v.object({ ...base, type: v.literal("text"), text: textId, params }),
    v.object({
      ...base,
      type: v.literal("heading"),
      text: textId,
      level: v.optional(v.picklist([2, 3])),
      params,
    }),
    v.object({ ...base, type: v.literal("note"), text: textId, params }),
    v.object({ ...base, type: v.literal("image"), asset: id(PATTERNS.step), alt: textId, caption: v.optional(textId) }),
    v.object({
      ...base,
      type: v.literal("code"),
      code: v.pipe(v.string(), v.maxLength(4000)),
      copy: v.optional(v.boolean()),
      language: v.optional(id(PATTERNS.name)),
    }),
    InputSchema,
    ChoiceSchema,
    v.object({ ...base, type: v.literal("group"), blocks: v.array(BlockSchema), title: v.optional(textId) }),
    v.object({ ...base, type: v.literal("link"), href: v.pipe(v.string(), v.maxLength(2000)), text: textId }),
    v.object({
      ...base,
      type: v.literal("requirement"),
      check: id(PATTERNS.action),
      text: textId,
      fix: v.optional(textId),
    }),
    v.object({ ...base, type: v.literal("divider") }),
    v.pipe(
      v.object({
        ...base,
        type: v.pipe(
          id(PATTERNS.name),
          v.check((t) => !KNOWN.has(t)),
        ),
      }),
      v.transform((block) => ({ ...block, type: "unknown" as const })),
    ),
  ]),
) as v.GenericSchema<unknown, Block>

const EdgeSchema = v.object({ when: v.optional(ConditionSchema), to: id(PATTERNS.step) })
const StepSchema = v.object({
  title: textId,
  kind: v.optional(v.picklist(["form", "run", "done"])),
  blocks: v.optional(v.array(BlockSchema)),
  next: v.optional(v.union([id(PATTERNS.step), v.array(EdgeSchema)])),
  back: v.optional(v.boolean()),
  action: v.optional(id(PATTERNS.action)),
  asks: v.optional(v.record(id(PATTERNS.name), InputSchema)),
  result: v.optional(id(PATTERNS.step)),
})
export type Step = v.InferOutput<typeof StepSchema>

const TextsSchema = v.record(id(PATTERNS.text), v.pipe(v.string(), v.maxLength(4000)))
const DocumentSchema = v.object({
  format: v.literal("wirecat.setup"),
  version: v.literal(1),
  tool: id(/^[a-z][a-z0-9-]{0,31}$/),
  toolVersion: v.optional(v.string()),
  requires: v.optional(v.array(id(PATTERNS.feature))),
  start: id(PATTERNS.step),
  steps: v.record(id(PATTERNS.step), StepSchema),
  assets: v.optional(
    v.record(
      id(PATTERNS.step),
      v.object({ file: v.string(), width: v.optional(v.number()), height: v.optional(v.number()) }),
    ),
  ),
  texts: v.intersect([v.object({ en: TextsSchema }), v.record(id(PATTERNS.language), TextsSchema)]),
  values: v.optional(v.record(v.string(), v.union([ValueSchema, v.object({ set: v.literal(true) })]))),
})
export type SetupDocument = v.InferOutput<typeof DocumentSchema>
export type Current = NonNullable<SetupDocument["values"]>

/** What the renderer supports, by the names `requires` uses; `options_from` and the tools' own run actions are not. */
const FEATURES = new Set<string>([
  "run",
  ...BLOCK_TYPES.map((type) => `block.${type}`),
  ...INPUT_KINDS.map((kind) => `input.${kind}`),
  ...Object.keys(DISPLAY_CLASSES).map((name) => `class.${name}`),
])
const RUN_ACTIONS = new Set(["apply"])

export const blocksOf = (blocks: readonly Block[] = [], depth = 1): { block: Block; depth: number }[] =>
  blocks.flatMap((block) => [{ block, depth }, ...(block.type === "group" ? blocksOf(block.blocks, depth + 1) : [])])

const conditionDepth = (c: Condition): number => {
  const inner = "all" in c ? c.all : "any" in c ? c.any : "not" in c ? [c.not] : []
  return 1 + inner.reduce((deepest, one) => Math.max(deepest, conditionDepth(one)), 0)
}

const targetsOf = (step: Step): string[] =>
  step.next === undefined ? [] : typeof step.next === "string" ? [step.next] : step.next.map(({ to }) => to)

export type Parsed =
  | { kind: "flow"; document: SetupDocument }
  /** A flow this renderer cannot draw whole: the dialog keeps the tool's hand-made form, or asks for an update. */
  | { kind: "unsupported"; why: string }

/** The document checked against the format and the limits, then against what this renderer can draw. */
export function parseSetup(raw: unknown): Parsed {
  const parsed = v.safeParse(DocumentSchema, raw)
  if (!parsed.success) {
    const issue = parsed.issues[0]
    return { kind: "unsupported", why: `${v.getDotPath(issue) ?? "document"}: ${issue.message}` }
  }
  const doc = parsed.output
  const unsupported = (why: string): Parsed => ({ kind: "unsupported", why })
  if (JSON.stringify(doc).length > SETUP_LIMITS.bytes) return unsupported("the document is over 256 KB")
  const steps = Object.entries(doc.steps)
  if (steps.length > SETUP_LIMITS.steps) return unsupported(`more than ${SETUP_LIMITS.steps} steps`)
  if (!doc.steps[doc.start]) return unsupported(`start names no step: ${doc.start}`)
  for (const feature of doc.requires ?? []) if (!FEATURES.has(feature)) return unsupported(`requires ${feature}`)
  for (const [name, step] of steps) {
    for (const target of targetsOf(step)) if (!doc.steps[target]) return unsupported(`${name} leads to no step`)
    if (step.kind === "run" && !RUN_ACTIONS.has(step.action ?? ""))
      return unsupported(`${name} runs ${step.action ?? "nothing"}, not a built-in action`)
    const conditions = [
      ...(Array.isArray(step.next) ? step.next.flatMap((edge) => (edge.when ? [edge.when] : [])) : []),
      ...blocksOf(step.blocks).flatMap(({ block }) => (block.when ? [block.when] : [])),
    ]
    if (conditions.some((c) => conditionDepth(c) > SETUP_LIMITS.depth)) return unsupported("conditions nest too deep")
    for (const { block, depth } of blocksOf(step.blocks)) {
      if (depth > SETUP_LIMITS.depth) return unsupported("groups nest too deep")
      if (block.type === "input" && block.options_from) return unsupported("options_from is not in v1")
    }
  }
  return { kind: "flow", document: doc }
}

export type Outcome = { outcome: "ok" } | { outcome: "error"; code: string }
export type Known = { field: (id: string) => unknown; result: (name: string) => Outcome | undefined }

const holds = (c: Condition, known: Known): boolean => {
  if ("all" in c) return c.all.every((one) => holds(one, known))
  if ("any" in c) return c.any.some((one) => holds(one, known))
  if ("not" in c) return !holds(c.not, known)
  if ("result" in c) {
    const outcome = known.result(c.result)
    if (!outcome) return false
    return "is" in c ? outcome.outcome === "ok" : outcome.outcome === "error" && outcome.code === c.error
  }
  const value = known.field(c.field)
  if ("set" in c) return (value !== undefined) === c.set
  if (value === undefined) return false
  if ("in" in c) return (c.in as unknown[]).includes(value)
  return value === c.is
}

export const shown = (block: Block, known: Known) => !block.when || holds(block.when, known)

/** The inputs on screen now: a hidden group hides everything in it. */
export const visibleFields = (blocks: readonly Block[] = [], known: Known): Field[] =>
  blocks.flatMap((block) => {
    if (!shown(block, known)) return []
    if (block.type === "group") return visibleFields(block.blocks, known)
    return block.type === "input" || block.type === "choice" ? [block as Field] : []
  })

const allFields = (doc: SetupDocument): Field[] =>
  Object.values(doc.steps).flatMap((step) =>
    blocksOf(step.blocks).flatMap(({ block }) =>
      block.type === "input" || block.type === "choice" ? [block as Field] : [],
    ),
  )

export const nextOf = (step: Step, known: Known): string | undefined => {
  if (typeof step.next === "string") return step.next
  return step.next?.find((edge) => !edge.when || holds(edge.when, known))?.to
}

const secretOf = (field: Field) => (field.type === "input" ? field.secret : undefined)
const isPassword = (field: Field) => field.type === "input" && field.input === "password"

export const blank = (value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)

/** A secret the profile already keeps: its field starts empty, and empty means "keep it". */
export const keptSecret = (field: Field, current: Current = {}) => {
  const secret = secretOf(field)
  return secret !== undefined && typeof current[secret] === "object" && current[secret] !== null
}

/** The profile's current value of a field, never a secret's. */
export const currentOf = (field: Field, current: Current = {}): Value | undefined => {
  if (field.setting === undefined) return undefined
  const value = current[field.setting]
  return value === undefined || (typeof value === "object" && !Array.isArray(value)) ? undefined : (value as Value)
}

/** What the CLI reads: a port or a number as a number, the rest as typed. */
const coerce = (field: Field, raw: unknown): unknown => {
  if (blank(raw)) return undefined
  const kind = field.type === "choice" ? "select" : field.input
  if ((kind === "port" || kind === "number") && typeof raw === "string") {
    const n = Number(raw.trim())
    return raw.trim() !== "" && Number.isFinite(n) ? n : raw
  }
  if (typeof raw === "string" && kind !== "password") return raw.trim() === "" ? undefined : raw
  return raw
}

export type Answers = Readonly<Record<string, unknown>>

/** `field` conditions read the answer, else the profile's current value; a result reads the run on this path. */
export const knownOf = (
  doc: SetupDocument,
  answers: Answers,
  results: Readonly<Record<string, Outcome>> = {},
): Known => {
  const fields = new Map(allFields(doc).map((f) => [f.id, f]))
  return {
    field: (name) => {
      const field = fields.get(name)
      if (!field) return undefined
      const value = coerce(field, answers[name])
      return value !== undefined ? value : currentOf(field, doc.values)
    },
    result: (name) => results[name],
  }
}

/**
 * The answers the CLI gets: only inputs shown on the steps visited, in their current state, so an answer on a branch
 * the owner left is never sent. A secret comes from `secrets` and is left out when empty: the CLI keeps the stored one.
 */
export function pathAnswers(
  doc: SetupDocument,
  visited: readonly string[],
  answers: Answers,
  secrets: ReadonlyMap<string, string>,
  results: Readonly<Record<string, Outcome>> = {},
): Record<string, unknown> {
  const known = knownOf(doc, answers, results)
  const sent: Record<string, unknown> = {}
  for (const name of visited) {
    const step = doc.steps[name]
    if (!step || (step.kind ?? "form") !== "form") continue
    for (const field of visibleFields(step.blocks, known)) {
      const value = isPassword(field) ? secrets.get(field.id) : coerce(field, answers[field.id])
      if (!blank(value)) sent[field.id] = value
    }
  }
  return sent
}

/** Text ids in the app's language, English when the language lacks one; `{name}` takes the block's params. */
export function textsOf(doc: SetupDocument, lang: string) {
  const own = (doc.texts as Record<string, Record<string, string>>)[lang] ?? {}
  return (textId: string | undefined, values: Record<string, string> = {}) =>
    textId === undefined
      ? ""
      : (own[textId] ?? doc.texts.en[textId] ?? textId).replace(
          /\{([a-z][a-z0-9_]*)\}/g,
          (all: string, name: string) => values[name] ?? all,
        )
}

const TRUSTED_HOSTS = ["wirecat.dev"]

/**
 * A link the document may show as a link: https, no user in it, to wirecat.dev, WireCat's GitHub or a domain the
 * catalog lists for the tool. Anything else is drawn as text.
 */
export function allowedLink(href: string, domains: readonly string[] = []): string | null {
  if (!/^https:\/\/[^\s"<>]{1,2000}$/.test(href)) return null
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  const under = (domain: string) => host === domain || host.endsWith(`.${domain}`)
  const github = host === "github.com" && /^\/WireCatLabs(\/|$)/.test(url.pathname)
  return github || [...TRUSTED_HOSTS, ...domains].some(under) ? url.href : null
}

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong" | "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] }
export type Markdown = { t: "p"; c: Inline[] } | { t: "h"; c: Inline[] } | { t: "ul" | "ol"; items: Inline[][] }

const INLINE = /(!?\[[^\]\n]*\]\([^)\s]*\))|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)/

/**
 * The restricted Markdown of a text: paragraphs, `#`–`###` lines, lists, **bold**, *italic*, `code` and links. Raw HTML
 * and images stay text; React escapes it when drawn.
 */
export function inline(text: string): Inline[] {
  const out: Inline[] = []
  let rest = text
  while (rest) {
    const m = INLINE.exec(rest)
    if (!m) {
      out.push({ t: "text", v: rest })
      break
    }
    if (m.index > 0) out.push({ t: "text", v: rest.slice(0, m.index) })
    const [all, link, code, strong] = m
    if (link?.startsWith("!")) out.push({ t: "text", v: all })
    else if (link) {
      const [, label = "", href = ""] = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(link) ?? []
      out.push({ t: "link", href, c: inline(label) })
    } else if (code) out.push({ t: "code", v: code.slice(1, -1) })
    else if (strong) out.push({ t: "strong", c: inline(strong.slice(2, -2)) })
    else out.push({ t: "em", c: inline(all.slice(1, -1)) })
    rest = rest.slice(m.index + all.length)
  }
  return out
}

export function markdown(text: string): Markdown[] {
  const out: Markdown[] = []
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((l) => l.trim())
    if (lines.length === 0) continue
    const bullet = lines.every((l) => /^\s*[-*] /.test(l))
    const numbered = lines.every((l) => /^\s*\d+[.)] /.test(l))
    if (bullet || numbered)
      out.push({
        t: bullet ? "ul" : "ol",
        items: lines.map((l) => inline(l.replace(/^\s*([-*]|\d+[.)]) /, ""))),
      })
    else if (lines.length === 1 && /^#{1,3} /.test(lines[0] ?? ""))
      out.push({ t: "h", c: inline((lines[0] ?? "").replace(/^#{1,3} /, "")) })
    else out.push({ t: "p", c: inline(lines.join(" ")) })
  }
  return out
}

const ProblemSchema = v.object({ input: v.string(), setting: v.nullish(v.string()), message: v.string() })
/** `setup apply --dry-run --json`'s item: the walk of the answers, and the first step that has a problem. */
export const DryRunSchema = v.object({
  valid: v.boolean(),
  complete: v.optional(v.boolean()),
  at: v.string(),
  path: v.optional(v.array(v.string())),
  errors: v.array(ProblemSchema),
})
export type DryRun = v.InferOutput<typeof DryRunSchema>

/**
 * The dry run's problems for the inputs on the step on screen. A dry run walks on past it and stops at the first step
 * with a problem; a stop further on means this step passed.
 */
export const problemsHere = (run: DryRun, fields: readonly Field[]): Record<string, string> => {
  const here = new Set(fields.map((f) => f.id))
  return Object.fromEntries(run.errors.filter((e) => here.has(e.input)).map((e) => [e.input, e.message]))
}
