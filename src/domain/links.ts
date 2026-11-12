// WireCat links (`wirecat://open/v1/…`, `https://wirecat.dev/o#/v1/…`): the v1 grammar cli-core's `src/domain/links.ts`
// writes. The desktop cannot import cli-core, so `links-v1.fixture.json` is a copy of its shared test file and both this
// parser and `src-tauri/src/deep_link.rs` must accept exactly what it lists. A link only opens a screen.

export type TaskFilter = "overdue" | "today" | "tomorrow" | "undated"

export type DeepLinkTarget =
  | { type: "message"; provider: string; account: string; chat: string; message: string }
  | { type: "chat"; provider: string; account: string; chat: string }
  | { type: "task"; id: string }
  | { type: "tasks"; filter: TaskFilter }
  | { type: "tasks"; filter: "new"; since: string }
  /** A review id as `memo review` shows it (`17070`, `fact:512`). */
  | { type: "proposal"; id: string }
  | { type: "digest"; date: string }
  /** memo's person id, as `person:<id>` names it. */
  | { type: "person"; id: string }
  | { type: "project"; key: string }
  | { type: "sync"; tool: string; account?: string }

// Links name a messenger as the store does (`telegram`); the catalog knows it by its tool id (`tg`).
const TOOL_OF: Record<string, string> = {
  telegram: "tg",
  "telegram-bot": "tg",
  whatsapp: "wa",
  "whatsapp-bot": "wa",
  "max-bot": "max",
  zoom: "zm",
  mail: "email",
  calendar: "gcal",
  "google-drive": "drive",
}

export const toolOfProvider = (provider: string): string => TOOL_OF[provider] ?? provider

const LINK_VERSION = "v1"
const APP_PREFIX = "wirecat://open"
const MAX_PATH = 512
const MAX_SEGMENTS = 6
const TASK_FILTERS: readonly string[] = ["overdue", "today", "tomorrow", "undated"]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

const isMoment = (text: string, pattern: RegExp) => pattern.test(text) && !Number.isNaN(Date.parse(text))

const partsOf = (target: DeepLinkTarget): string[] => {
  switch (target.type) {
    case "message":
      return ["msg", target.provider, target.account, target.chat, target.message]
    case "chat":
      return ["chat", target.provider, target.account, target.chat]
    case "task":
      return ["task", target.id]
    case "tasks":
      return target.filter === "new" ? ["tasks", "new", target.since] : ["tasks", target.filter]
    case "proposal":
      return ["proposal", target.id]
    case "digest":
      return ["digest", target.date]
    case "person":
      return ["person", target.id]
    case "project":
      return ["project", target.key]
    case "sync":
      return target.account === undefined ? ["sync", target.tool] : ["sync", target.tool, target.account]
  }
}

const targetOfParts = (parts: string[]): DeepLinkTarget | null => {
  const [kind, ...rest] = parts
  const [a = "", b = "", c = "", d = ""] = rest
  switch (kind) {
    case "msg":
      return rest.length === 4 ? { type: "message", provider: a, account: b, chat: c, message: d } : null
    case "chat":
      return rest.length === 3 ? { type: "chat", provider: a, account: b, chat: c } : null
    case "task":
      return rest.length === 1 ? { type: "task", id: a } : null
    case "tasks":
      if (rest.length === 1 && TASK_FILTERS.includes(a)) return { type: "tasks", filter: a as TaskFilter }
      return rest.length === 2 && a === "new" && (isMoment(b, DATE) || isMoment(b, DATE_TIME))
        ? { type: "tasks", filter: "new", since: b }
        : null
    case "proposal":
      return rest.length === 1 ? { type: "proposal", id: a } : null
    case "digest":
      return rest.length === 1 && isMoment(a, DATE) ? { type: "digest", date: a } : null
    case "person":
      return rest.length === 1 ? { type: "person", id: a } : null
    case "project":
      return rest.length === 1 ? { type: "project", key: a } : null
    case "sync":
      if (rest.length === 1) return { type: "sync", tool: a }
      return rest.length === 2 ? { type: "sync", tool: a, account: b } : null
    default:
      return null
  }
}

const targetOfPath = (path: string): DeepLinkTarget | null => {
  const raw = path.split("/")
  if (raw.some((part) => part === "")) return null
  try {
    return targetOfParts(raw.map(decodeURIComponent))
  } catch {
    return null
  }
}

/** `/v1/msg/max/1001/-2002/3003`: each part percent-encoded, so no id can add a part. */
export const formatLink = (target: DeepLinkTarget): string =>
  `/${LINK_VERSION}/${partsOf(target).map(encodeURIComponent).join("/")}`

export const appLink = (target: DeepLinkTarget): string => `${APP_PREFIX}${formatLink(target)}`

/** The target of a link in either form or of its bare path (`/v1/…`), or null for anything else. */
export const parseLink = (text: string): DeepLinkTarget | null => {
  const link = text.trim()
  const path = link.startsWith(`${APP_PREFIX}/`)
    ? link.slice(APP_PREFIX.length)
    : link.startsWith("https://") && link.includes("#")
      ? link.slice(link.indexOf("#") + 1)
      : link
  if (path.length > MAX_PATH || !path.startsWith(`/${LINK_VERSION}/`)) return null
  // A later version may add extras as a query; a v1 reader ignores them rather than refusing the link.
  const rest = (path.split("?")[0] ?? "").slice(LINK_VERSION.length + 2)
  if (rest.split("/").length + 1 > MAX_SEGMENTS) return null
  return targetOfPath(rest)
}

const LINK_ONLY = new Set(["tasks", "proposal", "digest", "sync", "person", "project"])

const encodedParts = (rest: string, count: number): string[] | null => {
  const parts = rest.split("/")
  if (parts.length !== count || parts.some((part) => part === "")) return null
  try {
    return parts.map(decodeURIComponent)
  } catch {
    return null
  }
}

/**
 * The target a digest item's ref names, or null. `msg:`, `chat:` and `task:` are store references (their parts
 * percent-encoded, a task id as it is); the kinds that are no reference are their path with a colon after the kind:
 * `proposal:fact%3A512`, `tasks:overdue`, `digest:2026-11-08`, `sync:telegram/1001`, `person:77`, `project:north-wind`.
 */
export const linkTargetOf = (ref: string): DeepLinkTarget | null => {
  const text = ref.trim()
  const colon = text.indexOf(":")
  if (colon < 0) return null
  const kind = text.slice(0, colon)
  const rest = text.slice(colon + 1)
  if (LINK_ONLY.has(kind)) return targetOfPath(`${kind}/${rest}`)
  if (kind === "task") return rest === "" ? null : { type: "task", id: rest }
  if (kind === "msg") {
    const p = encodedParts(rest, 4)
    return p
      ? { type: "message", provider: p[0] ?? "", account: p[1] ?? "", chat: p[2] ?? "", message: p[3] ?? "" }
      : null
  }
  if (kind === "chat") {
    const p = encodedParts(rest, 3)
    return p ? { type: "chat", provider: p[0] ?? "", account: p[1] ?? "", chat: p[2] ?? "" } : null
  }
  return null
}

/** The store reference a target names, for "Copy reference": what an agent or a CLI takes. */
export const referenceOf = (target: DeepLinkTarget): string => {
  const encoded = (...values: string[]) => values.map(encodeURIComponent).join("/")
  switch (target.type) {
    case "message":
      return `msg:${encoded(target.provider, target.account, target.chat, target.message)}`
    case "chat":
      return `chat:${encoded(target.provider, target.account, target.chat)}`
    case "task":
      return `task:${target.id}`
    default:
      return formatLink(target)
        .slice(LINK_VERSION.length + 2)
        .replace("/", ":")
  }
}
