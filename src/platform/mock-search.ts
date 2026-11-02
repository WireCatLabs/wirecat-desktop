import { findTool } from "@/domain/catalog"
import { delay } from "./mock-delay"
import type { SearchAnswer, SearchHit, ValueItem } from "./search-schemas"
import type { Platform } from "./types"

// Fictional stores for the browser build. `?search=<tool>` opens the page on that tool's hits, `?search=empty` on a
// query nothing matches, `?search-fail=query` on a query the tool refuses with a span, `?search-fail=tool` on the
// tool's own refusal, `?search-old=<tool>` makes that tool too old to search. Anywhere, a field the tool does not know
// or an unclosed bracket gets the tool's query error, so the bar can be tried by typing. What surrounds a hit:
// `?context-fail=old` (the tool is too old to show it), `?context-fail=tool` (the tool refuses). A query from plain
// words: `?search-ai=none` (nothing set up to write one), `?search-ai=fail` (the writer fails), `?search-ai=codex` (Codex
// writes it). The mock sends nothing anywhere: a few fixed rules stand in for the agent.
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const TOTAL = 128

// List lengths share no factor, so neighbouring hits never repeat one chat, sender and line together.
const CHATS = ["Harbour flat", "Design crit", "Family", "Climbing club", "Accountant", "Studio rent"]
const PEOPLE = ["Ana Ruiz", "Marco Bellini", "Jo Park", "Lena Vogel", "You"]
const LINES = [
  "Sent the invoice for October, can you check the VAT line?",
  "The invoice is attached, due on the 15th",
  "Let's move the review to Thursday, the invoice can wait",
  "Found the old invoice from the landlord in the shared folder",
  "Draft is ready, invoice numbers start at 2026-041",
  "Did the gym ever send an invoice for the October fees?",
  "Paid the electricity invoice, it was 20 € less than September",
]
const TITLES = ["Quarterly plan", "Invoice template", "Harbour flat lease", "Weekly sync", "Tax checklist"]

// Photos, voice messages and files often come without text: the page names what they carry instead.
const FILES = [
  { position: 1, kind: "photo" },
  { position: 1, kind: "voice" },
  { position: 1, kind: "document", name: "invoice.pdf", size: 48213 },
]

function hit(what: string, i: number): SearchHit {
  const at = new Date(Date.UTC(2026, 9, 30, 18, 0) - i * 7.3 * 3600_000).toISOString()
  const line = LINES[i % LINES.length]
  if (what === "messages")
    return {
      ref: `msg:telegram/1/-100${i}/${4000 + i}`,
      timestamp: at,
      chat_title: CHATS[i % CHATS.length],
      sender_name: PEOPLE[i % PEOPLE.length],
      sender_is_me: i % PEOPLE.length === 4,
      excerpt: i % 7 === 3 ? "" : line,
      ...(i % 7 === 3 ? { attachments: [FILES[i % FILES.length]] } : {}),
      matched_in: "text",
      score: Math.round((1 - i / TOTAL) * 1000) / 1000,
      untrusted: ["chat_title", "sender_name", "excerpt"],
    }
  if (what === "mail")
    return {
      ref: `msg:email/personal/INBOX/${9000 + i}`,
      timestamp: at,
      chat_title: "INBOX",
      sender_name: PEOPLE[i % 4],
      excerpt: line,
      email: { subject: `Re: ${TITLES[i % TITLES.length]}`, from: "ana@example.com", labels: ["inbox"] },
      untrusted: ["chat_title", "sender_name", "excerpt"],
    }
  if (what === "meetings")
    return {
      kind: "meeting",
      ref: `meeting:${i}/${100 + i}`,
      title: TITLES[i % TITLES.length],
      timestamp: at,
      excerpt: line,
      offset_ms: 60_000 * (i % 40),
      scope: "transcript",
      untrusted: ["title", "excerpt"],
    }
  return {
    ref: `document:${200 + i}`,
    kind: what === "notes" ? "note" : "document",
    title: TITLES[i % TITLES.length],
    path: `${TITLES[i % TITLES.length]}.md`,
    updated_at: at,
    excerpt: line,
    found_by: ["words"],
    ...(what === "documents" ? { url: `https://docs.google.com/document/d/mock${200 + i}/edit` } : {}),
  }
}

function refusal(id: string, query: string): SearchAnswer | null {
  const open = query.lastIndexOf("(")
  if (open >= 0 && !query.slice(open).includes(")"))
    return {
      kind: "queryError",
      reason: "query.invalid-syntax",
      message: `search: query.invalid-syntax at position ${query.length + 1}`,
      span: { start: query.length, end: query.length },
    }
  const fields = (findTool(id)?.search?.fields ?? []).map((f) => f.name)
  for (const m of query.matchAll(/(^|[\s(])-?([a-z_]+):/g)) {
    const field = m[2] ?? ""
    if (fields.includes(field)) continue
    const start = (m.index ?? 0) + (m[1]?.length ?? 0)
    const end = query.slice(start).search(/\s|$/) + start
    return {
      kind: "queryError",
      reason: "query.unknown-field",
      message: `search: query.unknown-field at position ${start + 1} — no field "${field}"`,
      span: { start, end },
    }
  }
  return null
}

// Two chats share a title, and one's title is another's username, as on a real account.
const VALUES: Record<string, ValueItem[]> = {
  chats: [
    ...CHATS.map((title, i) => ({ value: `-100${1000 + i}`, label: title, detail: null })),
    { value: "-1001762030832", label: "kyrillic", detail: "kyrillic" },
    { value: "-1001334573228", label: "kyrillic", detail: null },
  ],
  contacts: PEOPLE.filter((p) => p !== "You").map((name, i) => ({ value: String(500 + i), label: name, detail: null })),
  tags: ["work", "family", "receipts"].map((value) => ({ value, label: null, detail: null })),
}

// One short conversation: five messages before the hit, five after.
const BEFORE = [
  "Morning! Are we still on for Thursday?",
  "Yes, 10:30 works for me",
  "Good. One thing before then",
  "Go ahead",
  "It's about the October paperwork",
]
const AFTER = [
  "Here's the PDF",
  "Thanks, I'll look at it tonight",
  "Looks right to me, I'll pass it to the accountant",
  "Perfect, thank you",
  "See you Thursday then",
]
const SPOKEN = [
  "Let's start with the numbers from last week",
  "Bookings are up a little, mostly weekends",
  "Weekdays are still quiet before noon",
  "Could we try a morning discount?",
  "Maybe, but only if the clinic agrees",
  "I'll ask them on Friday",
  "Next item is the new website",
  "The designer sent two versions yesterday",
  "I prefer the second one, it reads better on a phone",
  "Same here",
  "Then we go with the second",
  "Anything else before we close?",
  "Only the holiday rota, I'll send it by mail",
]

// The shapes the tools print: `messages context` and memo's `messages show` list `items`, `meetings transcript`
// lists each transcript with its `lines`.
function around(what: string, ref: string): unknown {
  if (what === "meetings")
    return {
      items: [
        {
          ref: "transcript:1",
          lines: Array.from({ length: 40 }, (_, i) => ({
            position: i,
            offset_ms: i * 60_000,
            end_ms: i * 60_000 + 55_000,
            speaker: PEOPLE[i % 4],
            text: i % 7 === 3 ? LINES[i % LINES.length] : SPOKEN[i % SPOKEN.length],
          })),
        },
      ],
    }
  const at = Date.UTC(2026, 9, 30, 18, 0)
  // The hit's own number is the last part of its ref (`hit` above), so the middle message is the one clicked.
  const n = Math.max(0, Number(ref.split("/").pop()) - 4000) || 0
  const sender = PEOPLE[n % PEOPLE.length] ?? "You"
  const other = sender === "You" ? (PEOPLE[0] ?? "") : sender
  const texts = [...BEFORE, LINES[n % LINES.length] ?? "", ...AFTER]
  return {
    items: texts.map((text, i) => {
      const name = i === 5 ? sender : i % 2 === 0 ? other : "You"
      return {
        ref: i === 5 ? ref : `${ref}-${i}`,
        timestamp: new Date(at + (i - 5) * 240_000).toISOString(),
        sender_name: name,
        sender_is_me: name === "You",
        text,
        attachments: i === 6 ? [{ kind: "file", name: "invoice-2026-10.pdf", size: 48_211 }] : [],
        anchor: what === "messages" && i === 5 ? true : undefined,
      }
    }),
  }
}

// Russian names after у/от/с stand in the genitive or instrumental; a query names people in the nominative.
const ENDINGS: [RegExp, string][] = [
  [/ея$/u, "ей"],
  [/ей$/u, "я"],
  [/ой$/u, "а"],
  [/([гкхжчшщ])и$/u, "$1а"],
  [/ы$/u, "а"],
  [/и$/u, "я"],
  [/([бвдзлмнпрстф])а$/u, "$1"],
]

function nominative(name: string): string {
  const ending = ENDINGS.find(([re]) => re.test(name))
  return ending ? name.replace(ending[0], ending[1]) : name
}

const FILLER = new Set(
  (
    "a an the find show me my messages message about from in on of with that what where how sent last this week month " +
    "найди покажи сообщения сообщение про о об что где как у от с за на в из прошлой этой неделе неделю месяц " +
    "busca muestra mensajes sobre de que el la los las del en"
  ).split(" "),
)

// Stand-in for the agent in the browser build: a few patterns in English and Russian, only the tool's own keys.
function draft(id: string, request: string): string {
  const fields = new Set((findTool(id)?.search?.fields ?? []).map((f) => f.name))
  const words = request.toLowerCase()
  const terms: string[] = []
  const latin = request.match(/\bfrom ([A-Z][\p{L}]+(?: [A-Z][\p{L}]+)?)/u)?.[1]
  const cyrillic = request.match(/(?:^|\s)(?:у|от|с)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/u)?.[1]
  const person = latin ?? cyrillic?.split(" ").map(nominative).join(" ")
  const personKey = fields.has("from") ? "from" : fields.has("author") ? "author" : null
  if (person) terms.push(personKey ? `${personKey}:"${person}"` : person)
  const chat = request.match(/\bin (?:the )?"?([A-Z][\p{L} ]+?)"? (?:chat|group)\b/u)?.[1]
  if (chat && fields.has("chat")) terms.push(`chat:"${chat}"`)
  const kinds: [RegExp, string][] = [
    [/photo|picture|фото/u, "photo"],
    [/\bfiles?\b|файл/u, "file"],
    [/link|ссылк/u, "link"],
    [/\bvoice|голосов/u, "voice"],
  ]
  const has = kinds.find(([word]) => word.test(words))?.[1]
  if (has && fields.has("has")) terms.push(`has:${has}`)
  if (/last week|this week|7 days|недел/u.test(words) && fields.has("date")) terms.push("date>=7d")
  else if (/last month|30 days|месяц/u.test(words) && fields.has("date")) terms.push("date>=30d")
  const said = new Set([
    ...(cyrillic ?? latin ?? "").toLowerCase().split(" "),
    ...(chat ?? "").toLowerCase().split(" "),
  ])
  const topic = words
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FILLER.has(w) && !said.has(w) && !kinds.some(([k]) => k.test(w)))
    .filter(
      (w) => !/^(photos?|pictures?|files?|links?|voice|фото\p{L}*|ссылк\p{L}*|голосов\p{L}*|chat|group)$/u.test(w),
    )
  terms.unshift(...topic.slice(0, 3))
  return terms.join(" ")
}

export const searchMock: Pick<Platform, "searchStore" | "searchValues" | "searchContext" | "searchDraft"> = {
  async searchDraft(id, request) {
    await delay(1800)
    const mode = params.get("search-ai")
    const by = mode === "codex" ? "codex" : "claude-code"
    if (mode === "none") return { kind: "none" }
    if (mode === "fail") return { kind: "failed", by, reason: "other", message: "Claude AI usage limit reached" }
    if (mode === "signedout") return { kind: "failed", by, reason: "signed-out", message: "" }
    const query = draft(id, request)
    if (!query) return { kind: "failed", by, reason: "empty", message: "" }
    return { kind: "query", by, query }
  },
  async searchContext(id, _profile, reference) {
    await delay(500)
    const search = findTool(id)?.search
    if (!search?.context) throw new Error("this tool shows nothing around a result")
    const fail = params.get("context-fail")
    if (fail === "old") return { kind: "old", message: "unknown command 'context'" }
    if (fail === "tool") return { kind: "failed", message: `${reference} is not in the local store` }
    return { kind: "found", body: around(search.what, reference) }
  },
  async searchValues(id, _profile, source) {
    await delay(300)
    if (!findTool(id)?.search?.values[source]) throw new Error(`no value list named ${source}`)
    return VALUES[source] ?? []
  },
  async searchStore(id, _profile, query, limit, page) {
    await delay(700)
    const tool = findTool(id)
    const search = tool?.search
    if (!tool || !search) throw new Error("This tool cannot search its local data.")
    if (params.get("search-old") === id) return { kind: "old", message: "unknown option '--offline'" }
    if (params.get("search-fail") === "tool")
      return {
        kind: "failed",
        candidates: [],
        message: `nothing recorded for profile "personal" yet — log in with \`${tool.bin} personal setup\``,
      }
    if (/(^|\s)-?chat:kyrillic(\s|$)/.test(query))
      return {
        kind: "failed",
        message:
          '"kyrillic" matches 2 chats — name one by its id:\n  -1001762030832  @kyrillic\n  -1001334573228  kyrillic',
        candidates: [
          { id: "-1001762030832", label: "@kyrillic", field: "chat" },
          { id: "-1001334573228", label: "kyrillic", field: "chat" },
        ],
      }
    const refused = refusal(id, query)
    if (refused) return refused
    const paged = search.args.includes("{page}")
    const total = params.get("search") === "empty" ? 0 : paged ? TOTAL : limit
    const from = (page - 1) * limit
    const hits = Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, i) =>
      hit(search.what, from + i),
    )
    const notes = search.what === "messages" ? ["searched 12,480 messages in 64 chats — 3 never fetched, 5 behind"] : []
    return {
      kind: "hits",
      hits,
      hasMore: paged && from + limit < total,
      paged,
      notes,
      total: { value: params.get("search") === "empty" ? 0 : TOTAL, relation: "eq" },
    }
  },
}
