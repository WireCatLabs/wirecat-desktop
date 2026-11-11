import { toolOfProvider } from "./links"
/** What the Search page shows of one hit. Every value is the tool's own text, shown as plain text only. */
export type HitRow = {
  key: string
  when: string | null
  /** The chat, mailbox subject, meeting or document the hit is in. */
  where: string | null
  /** The tool a memo hit came from (`msg:telegram/…` is `tg`); a tool's own hits are all its own, so none. */
  tool: string | null
  who: string | null
  fromMe: boolean
  text: string | null
  /** What the message carries (cli-core 0.532.0+ hits name their files); older tools send none. */
  files: HitFile[]
}

export type HitFile = { kind: string; name: string | null }

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

// Messages carry chat_title and sender_name, mail adds email.subject, meetings, notes and documents a title or path.
export function hitRow(hit: Record<string, unknown>, index: number): HitRow {
  return {
    key: str(hit.ref) ?? str(hit.id) ?? `#${index}`,
    when: str(hit.timestamp) ?? str(hit.updated_at) ?? str(hit.started_at),
    where: str(obj(hit.email).subject) ?? str(hit.chat_title) ?? str(hit.title) ?? str(hit.path),
    tool: toolOfRef(str(hit.ref)),
    who: str(hit.sender_name),
    fromMe: hit.sender_is_me === true,
    text: str(hit.excerpt) ?? str(hit.text),
    files: hitFiles(hit),
  }
}

const toolOfRef = (ref: string | null) => {
  const provider = ref?.match(/^msg:([a-z0-9-]+)\//)?.[1]
  return provider ? toolOfProvider(provider) : null
}

export function hitFiles(hit: Record<string, unknown>): HitFile[] {
  const list = Array.isArray(hit.attachments) ? hit.attachments : []
  return list.flatMap((raw) => {
    const f = obj(raw)
    const kind = str(f.kind)
    return kind ? [{ kind, name: str(f.name) }] : []
  })
}

/**
 * The tool counts the span in the query it parsed; memo and drive count one or two places past the text typed, so the
 * span is kept inside the query and never points past its end.
 */
export function clampSpan(span: { start: number; end: number } | null, length: number) {
  if (!span) return null
  const start = Math.max(0, Math.min(span.start, length))
  return { start, end: Math.max(start, Math.min(span.end, length)) }
}

/** The closed reasons of cli-base's query language (`src/query/`); any other is shown in the tool's words. */
export const QUERY_REASONS = [
  "bare-word",
  "invalid-ast",
  "invalid-date",
  "invalid-escape",
  "invalid-number",
  "invalid-regex",
  "invalid-syntax",
  "invalid-tag",
  "invalid-timezone",
  "missing-value",
  "too-large",
  "unclosed-literal",
  "unknown-field",
  "unknown-value",
  "unsupported-field",
  "unsupported-operator",
  "unsupported-placement",
  "unsupported-regex",
  "unsupported-regex-flags",
  "unsupported-version",
] as const
export type QueryReason = (typeof QUERY_REASONS)[number]

export function queryReason(reason: string): QueryReason | null {
  const short = reason.startsWith("query.") ? reason.slice("query.".length) : reason
  return (QUERY_REASONS as readonly string[]).includes(short) ? (short as QueryReason) : null
}

/** "no field \"bogus\"" after the reason's own words: the part of the tool's message that names what was wrong. */
export function errorDetail(message: string): string | null {
  const dash = message.lastIndexOf(" — ")
  return dash >= 0 ? message.slice(dash + 3).trim() || null : null
}

/** One row of the query bar's list. `whole` replaces the whole query; `open` keeps typing after it, no space. */
export type QueryOption = {
  label: string
  insert: string
  note?: string | null
  example?: string | null
  group?: string | null
  whole?: boolean
  open?: boolean
  /** The "More fields" row: shows the fields hidden at first, and inserts nothing. */
  more?: boolean
}
export type QueryOptions = { from: number; to: number; items: QueryOption[] }

export type FieldGroup = "who" | "where" | "when" | "what" | "files"
export const GROUPS: readonly FieldGroup[] = ["who", "where", "when", "what", "files"]

export type SearchFieldInfo = {
  name: string
  group: FieldGroup
  example: string
  top: boolean
}

export type SuggestWords = {
  group: Record<FieldGroup, string>
  describe: (field: string) => string | null
  more: string
  popularHeading: string
  datesHeading: string
  valuesHeading: (field: string) => string
  /** "1 234 messages": how often a person wrote, or how many messages a chat holds. */
  count: (n: number) => string
}

const pad = (n: number) => String(n).padStart(2, "0")
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export type DateMeaning = "last7" | "last30" | "today" | "yesterday" | "thisMonth" | "since" | "between"

/** Each form checked against the installed tools: messages, notes, documents and mail take all of them. */
export function dateOptions(now: Date): { query: string; meaning: DateMeaning }[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [
    { query: "date>=7d", meaning: "last7" },
    { query: "date>=30d", meaning: "last30" },
    { query: "date:today", meaning: "today" },
    { query: "date:yesterday", meaning: "yesterday" },
    { query: `date>=${day(first)}`, meaning: "thisMonth" },
    { query: `date:[${day(first)} TO *]`, meaning: "since" },
    { query: `date:[${day(first)} TO ${day(last)}]`, meaning: "between" },
  ]
}

/** The order keys start in before the owner has searched with any: the filters people reach for first. */
const POPULAR_FIELDS: Readonly<Record<string, readonly string[]>> = {
  messages: ["from", "chat", "date", "has", "kind", "tag"],
  mail: ["from", "subject", "date", "mailbox", "label"],
  notes: ["title", "tag", "date", "author"],
  documents: ["title", "tag", "date", "author"],
}

/** How many of the most used keys lead the list; the rest follow by group. */
const LEAD = 5

/** The keys a query filters by, once each: `from:`, `-chat:`, `date>=`. Only names, never the values typed. */
export function fieldsIn(query: string): string[] {
  const out = new Set<string>()
  for (let at = 0; at <= query.length; ) {
    const tok = tokenAt(query, at)
    const name = /^[-+]?([a-z_]+)(?::|>=|<=|>|<)/i.exec(tok.raw)?.[1]
    if (name) out.add(name.toLowerCase())
    at = tok.end + 1
  }
  return [...out]
}

/** Most used by the owner first, then the usual first filters, then by group. */
export function rankFields(
  fields: readonly SearchFieldInfo[],
  what: string,
  used: Readonly<Record<string, number>>,
): SearchFieldInfo[] {
  const popular = POPULAR_FIELDS[what] ?? []
  const place = (name: string) => (popular.includes(name) ? popular.indexOf(name) : popular.length)
  return [...fields].sort(
    (a, b) =>
      (used[b.name] ?? 0) - (used[a.name] ?? 0) ||
      place(a.name) - place(b.name) ||
      GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group),
  )
}

/**
 * A value as the tools' query parser reads it (cli-base `src/query/parser.ts`): a bare term stops at whitespace and at
 * its reserved characters (`+ - ! ( ) : = ^ @ < > [ ] " { } ~ \\ /`), a leading one is an operator, `*` and `?` make
 * a wildcard, and AND, OR and NOT are words of the language. Anything but letters, digits, `_` and inner dots is
 * therefore quoted, with `"` and `\\` escaped inside.
 */
export const quoteValue = (value: string) =>
  /^[\p{L}\p{N}_](?:[\p{L}\p{N}_.]*[\p{L}\p{N}_])?$/u.test(value) && !/^(AND|OR|NOT)$/.test(value)
    ? value
    : `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`

// These take * and ? in every cli-core the app runs with; a pattern elsewhere needs a newer one.
const ALWAYS_PATTERNS = new Set(["text", "exact", "body", "filename", "mime"])

/**
 * A written query as a tool on an older cli-core reads it: a part-of-name or part-of-value pattern (`from:*Мила*`,
 * `subject:отчет*`) becomes the plain value (`from:Мила`; such a tool reads it as part of a name only when nobody is
 * named exactly that). A word's start (`аренд*`) stays. Null when nothing changes, so the caller does not ask twice.
 */
export function withoutPatterns(query: string): string | null {
  const term = /(^|[\s(])(-?)(?:([\p{L}_][\p{L}\p{N}_]*):)?((?:\\.|[^\s()"\\:])*[*?](?:\\.|[^\s()"\\])*)/gu
  let changed = false
  const out = query.replace(term, (whole, lead: string, minus: string, field: string | undefined, value: string) => {
    if (!field || ALWAYS_PATTERNS.has(field)) return whole
    const plain = value.replace(/\\(.)|[*?]/gu, (_, kept: string | undefined) => kept ?? "")
    changed = true
    if (!plain) return lead
    return `${lead}${minus}${field}:${quoteValue(plain)}`
  })
  return changed ? out.replace(/\s{2,}/g, " ").trim() : null
}

/**
 * One value a field can take: `value` goes in the query; `label` and `detail` (an @username) are what the row shows;
 * `count` (messages from that person or in that chat) puts the most used first.
 */
export type ValueOption = { value: string; label?: string | null; detail?: string | null; count?: number | null }

/** As cli-core compares names (`foldName`): any case, and е for ё, which is how Russian is mostly typed. */
export const foldText = (text: string) => text.normalize("NFC").toLowerCase().replaceAll("ё", "е")

const byCount = (a: ValueOption, b: ValueOption) => (b.count ?? -1) - (a.count ?? -1)

/** The values whose name, @username or id start with `typed`, then those that contain it; most used first in each. */
export function matchingValues(all: readonly ValueOption[], typed: string): ValueOption[] {
  const wanted = foldText(typed)
  const texts = (v: ValueOption) =>
    [v.label, v.detail, v.detail ? `@${v.detail.replace(/^@/, "")}` : null, v.value]
      .filter(Boolean)
      .map((t) => foldText(t as string))
  const starts = all.filter((v) => texts(v).some((t) => t.startsWith(wanted)))
  const contains = all.filter((v) => !starts.includes(v) && texts(v).some((t) => t.includes(wanted)))
  return [...starts.sort(byCount), ...contains.sort(byCount)]
}

type Token = { start: number; end: number; raw: string }

// Whitespace ends a term except inside quotes or a [a TO b] range, so a value being typed stays one token.
function tokenAt(query: string, cursor: number): Token {
  let start = 0
  let quote = false
  let range = 0
  for (let i = 0; i <= query.length; i++) {
    const c = query[i]
    if (i === query.length || (/\s/.test(c ?? "") && !quote && range === 0)) {
      if (cursor >= start && cursor <= i) return { start, end: i, raw: query.slice(start, i) }
      start = i + 1
      continue
    }
    if (c === '"') quote = !quote
    else if (c === "[" && !quote) range++
    else if (c === "]" && !quote && range > 0) range--
  }
  return { start: cursor, end: cursor, raw: "" }
}

const fieldRow = (f: SearchFieldInfo, sign: string, words: SuggestWords, group: string | null): QueryOption => ({
  label: f.name === "date" ? "date" : `${f.name}:`,
  insert: f.name === "date" ? `${sign}date` : `${sign}${f.name}:`,
  note: words.describe(f.name),
  example: f.example,
  group,
  open: true,
})

const byGroup = (fields: SearchFieldInfo[]) =>
  [...fields].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group))

export type SuggestContext = {
  fields: SearchFieldInfo[]
  /** Every value a field can be given here: its fixed list, the tool's own list, and what the results show. */
  values: Readonly<Record<string, readonly ValueOption[]>>
  /** How many searches that found an answer used each key, kept on this computer. */
  used: Readonly<Record<string, number>>
  /** "More fields" was chosen: every field, not only the first few. */
  all: boolean
  now: Date
  words: SuggestWords
  dateWords: Record<DateMeaning, string>
  what: string
}

/**
 * The most used keys first, then the rest of the first fields by group, the others behind "More fields" until it is
 * chosen. A key the owner used counts as a first field even when the catalog keeps it behind "More fields".
 */
function fieldRows(ctx: SuggestContext, sign: string): QueryOption[] {
  const ranked = rankFields(ctx.fields, ctx.what, ctx.used)
  const shown = ctx.all ? ranked : ranked.filter((f) => f.top || (ctx.used[f.name] ?? 0) > 0)
  const lead = shown.slice(0, LEAD)
  const rest = byGroup(shown.slice(LEAD))
  const items = [
    ...lead.map((f) => fieldRow(f, sign, ctx.words, ctx.words.popularHeading)),
    ...rest.map((f) => fieldRow(f, sign, ctx.words, ctx.words.group[f.group])),
  ]
  if (!ctx.all && shown.length < ctx.fields.length) items.push({ label: ctx.words.more, insert: "", more: true })
  return items
}

export function suggestSearch(query: string, cursor: number, ctx: SuggestContext): QueryOptions {
  if (query.trim() === "") return { from: 0, to: query.length, items: fieldRows(ctx, "") }
  const tok = tokenAt(query, cursor)
  const sign = /^[-+]/.test(tok.raw) ? (tok.raw[0] as string) : ""
  const body = tok.raw.slice(sign.length)
  const hasDate = ctx.fields.some((f) => f.name === "date")
  const at = { from: tok.start, to: tok.end }

  if (hasDate && /^date/i.test(body) && body.length >= 4) {
    const typed = body.toLowerCase()
    const items = dateOptions(ctx.now)
      .filter((o) => typed === "date" || typed === "date:" || (o.query.startsWith(typed) && o.query !== typed))
      .map((o) => ({
        label: o.query,
        insert: sign + o.query,
        note: ctx.dateWords[o.meaning],
        group: ctx.words.datesHeading,
      }))
    return { ...at, items }
  }

  const colon = body.indexOf(":")
  if (colon > 0) {
    const field = body.slice(0, colon).toLowerCase()
    const typed = body
      .slice(colon + 1)
      .replace(/^"/, "")
      .replace(/"$/, "")
    const items = matchingValues(ctx.values[field] ?? [], typed)
      .filter((v) => foldText(v.value) !== foldText(typed))
      .slice(0, 40)
      .map((v) => ({
        label: v.label ?? v.value,
        insert: `${sign}${field}:${quoteValue(v.value)}`,
        note:
          [v.detail ? `@${v.detail.replace(/^@/, "")}` : null, v.count ? ctx.words.count(v.count) : null]
            .filter(Boolean)
            .join(" · ") || null,
        example: v.label && v.label !== v.value ? v.value : null,
        group: ctx.words.valuesHeading(field),
      }))
    return { ...at, items }
  }

  const prefix = body.toLowerCase()
  if (prefix === "") return { ...at, items: fieldRows(ctx, sign) }
  const items = rankFields(
    ctx.fields.filter((f) => f.name.startsWith(prefix) && f.name !== prefix),
    ctx.what,
    ctx.used,
  ).map((f) => fieldRow(f, sign, ctx.words, null))
  return { ...at, items }
}

/**
 * The chat titles and sender names the shown hits carry. They only move matching list entries up: a title can name
 * two chats, so what goes in the query is always the list entry's id.
 */
export function valuesInHits(hits: readonly Record<string, unknown>[]): Record<string, string[]> {
  const seen: Record<string, Set<string>> = { chat: new Set(), from: new Set(), title: new Set() }
  for (const hit of hits) {
    const row = hitRow(hit, 0)
    if (typeof hit.chat_title === "string" && hit.chat_title.trim()) seen.chat?.add(hit.chat_title.trim())
    if (row.who && !row.fromMe) seen.from?.add(row.who)
    if (typeof hit.title === "string" && hit.title.trim()) seen.title?.add(hit.title.trim())
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]))
}

/**
 * The `field:` term an ambiguous name came from, so a choice can replace it. With several such terms, the one whose
 * value appears in a candidate's label; this reads the owner's own query, never the tool's answer.
 */
export function ambiguousTerm(
  query: string,
  field: string,
  labels: readonly (string | null)[],
): { start: number; end: number; sign: string } | null {
  const terms: Token[] = []
  for (let at = 0; at <= query.length; ) {
    const tok = tokenAt(query, at)
    if (tok.raw) terms.push(tok)
    at = tok.end + 1
  }
  const ofField = terms
    .map((t) => ({ ...t, sign: /^[-+]/.test(t.raw) ? (t.raw[0] as string) : "" }))
    .filter((t) => t.raw.slice(t.sign.length).toLowerCase().startsWith(`${field}:`))
  const typedIn = (t: Token & { sign: string }) =>
    t.raw
      .slice(t.sign.length + field.length + 1)
      .replace(/^"|"$/g, "")
      .replace(/^@/, "")
      .toLowerCase()
  const named = labels.filter((l): l is string => Boolean(l)).map((l) => l.toLowerCase())
  const found = ofField.find((t) => typedIn(t) !== "" && named.some((l) => l.includes(typedIn(t)))) ?? ofField[0]
  return found ? { start: found.start, end: found.end, sign: found.sign } : null
}

/** One list of values from several sources, once per id: the first source's text wins, a later one fills the gaps. */
export function mergeValues(...lists: readonly (readonly ValueOption[])[]): ValueOption[] {
  const out = new Map<string, ValueOption>()
  for (const list of lists)
    for (const v of list) {
      const had = out.get(v.value)
      out.set(
        v.value,
        had
          ? {
              value: v.value,
              label: had.label ?? v.label ?? null,
              detail: had.detail ?? v.detail ?? null,
              count: had.count ?? v.count ?? null,
            }
          : v,
      )
    }
  return [...out.values()]
}

export type RefusedName = { id: string; label: string | null; field: "chat" | "from" | null }

/** The name in a refused term, and every person or chat whose name holds it, as queries that name one by its id. */
export type NameChoices = {
  field: "chat" | "from"
  typed: string
  term: { start: number; end: number; sign: string }
  options: (ValueOption & { query: string })[]
}

// cli-core's words for a name that fits nobody: `senderAmong` and `pickChat`/`chatAmong` (message-resolution.ts).
const NOBODY = /^from:.* — nobody matches "(.*)"$/s
const NO_CHAT = /no (?:stored )?chat matches "(.*)"$/s
const CHOICES = 8

/**
 * A `from:` or `chat:` the tool refused, because the name fits several or none, answered with the people or chats
 * whose name contains what was typed, most messages first. cli-core settles on exact names when there are any, so
 * "Ярослав" lists the two people called just that and hides "Ярослав Петров"; the list here shows them all.
 */
export function nameChoices(
  query: string,
  message: string,
  candidates: readonly RefusedName[],
  known: Readonly<Record<string, readonly ValueOption[]>>,
): NameChoices | null {
  const from = NOBODY.exec(message)
  const chat = NO_CHAT.exec(message)
  const field = candidates.find((c) => c.field)?.field ?? (from ? "from" : chat ? "chat" : null)
  if (!field) return null
  const missed = (from ?? chat)?.[1]
  const term = ambiguousTerm(query, field, missed !== undefined ? [missed] : candidates.map((c) => c.label))
  if (!term) return null
  const typed = query
    .slice(term.start + term.sign.length + field.length + 1, term.end)
    .replace(/^"|"$/g, "")
    .replace(/\\(.)/g, "$1")
  const refused = candidates.filter((c) => c.field === field).map((c) => ({ value: c.id, label: c.label }))
  const pool = mergeValues(known[field] ?? [], refused)
  const found = typed.trim() ? matchingValues(pool, typed.trim()).slice(0, CHOICES) : []
  const listed = mergeValues(
    found,
    refused.filter((c) => !found.some((f) => f.value === c.value)),
  )
  const options = listed.map((v) => ({
    ...v,
    query: `${query.slice(0, term.start)}${term.sign}${field}:${quoteValue(v.value)}${query.slice(term.end)}`,
  }))
  return options.length ? { field, typed, term, options } : null
}

/**
 * Where each query field's value sits in a hit, as the tools print them (`src/platform/mock-search.ts` follows the
 * same shapes). A hit key with no field here cannot be filtered on: the tool's query has no field for it.
 */
const HIT_PATHS: Record<string, readonly (readonly string[])[]> = {
  chat: [["chat_title"]],
  from: [["sender_name"], ["email", "from"]],
  label: [["email", "labels"]],
  title: [["title"]],
  tag: [["tags"]],
}

/** The query field a value in a hit's details filters on, or null; only fields this tool's search knows. */
export function hitField(path: readonly string[], known: readonly string[]): string | null {
  // A list's element filters like the list: ["tags", "0"] is a tag.
  const at = /^\d+$/.test(path.at(-1) ?? "") ? path.slice(0, -1) : path
  for (const [field, paths] of Object.entries(HIT_PATHS))
    if (known.includes(field) && paths.some((p) => p.length === at.length && p.every((k, i) => k === at[i])))
      return field
  return null
}

/** The values a hit has for a query field; a list gives each element. */
export function hitValues(hit: Record<string, unknown>, field: string): string[] {
  for (const path of HIT_PATHS[field] ?? []) {
    let v: unknown = hit
    for (const k of path) v = obj(v)[k]
    if (hit.sender_is_me === true && field === "from" && path[0] === "sender_name") continue
    const list = (Array.isArray(v) ? v : [v]).map(str).filter((s): s is string => s !== null)
    if (list.length > 0) return list
  }
  return []
}

/** Adds `field:value` (or `-field:value`) to the query; the same term again takes it out, as Logs does. */
export function toggleSearchTerm(query: string, field: string, value: string, negate = false): string {
  const term = `${negate ? "-" : ""}${field}:${quoteValue(value)}`
  const parts = query.trim() === "" ? [] : query.trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/)
  return parts.includes(term) ? parts.filter((p) => p !== term).join(" ") : [...parts, term].join(" ")
}

export type HitGroup = { value: string; count: number; last: string | null }

/** The shown hits by one field's value, most first; a hit without the field counts under "". */
export function groupHits(hits: readonly Record<string, unknown>[], field: string): HitGroup[] {
  const groups = new Map<string, HitGroup>()
  hits.forEach((hit, i) => {
    const when = hitRow(hit, i).when
    const values = hitValues(hit, field)
    for (const value of values.length ? values : [""]) {
      const g = groups.get(value) ?? { value, count: 0, last: null }
      g.count++
      if (when && (!g.last || when > g.last)) g.last = when
      groups.set(value, g)
    }
  })
  return [...groups.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}
