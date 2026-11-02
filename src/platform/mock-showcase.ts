import { findTool, ownerId, tools } from "@/domain/catalog"
import type { StoreCompat } from "@/domain/compat"
import type { Agent } from "./agents-schemas"
import { delay } from "./mock-delay"
import { SHOWCASE_TEXT, showcaseLang } from "./mock-showcase-text"
import type { RunItem } from "./runs-schemas"
import type { SearchHit } from "./search-schemas"
import type { Platform } from "./types"

// `?showcase`: the healthy machine for the website's screenshots. Every tool installed at its current version, signed
// in as personal and synced minutes ago, agents with current skills, no warnings. Overrides only; every other
// scenario keeps the stock mock. Onboarding, the Agents dot and the bell are set in `src/app/scenarios.ts`.

export const showcase = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).has("showcase")

// ToolsIntro reads this key while it first renders, before any scenario runs.
if (showcase) {
  try {
    localStorage.setItem("wirecat.tools.intro", "hidden")
  } catch {
    // No storage: the intro shows, nothing else changes.
  }
}

// The versions on npm when the website screenshots were taken (2026-11-02), so visitors see current numbers.
export const SHOWCASE_VERSIONS: Record<string, string> = {
  tg: "0.112.0",
  max: "0.95.0",
  wa: "0.23.0",
  zm: "0.64.0",
  drive: "0.55.0",
  memo: "0.131.14",
}

const MIN = 60_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

const AGENTS: Agent[] = [
  { id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] },
  { id: "codex", name: "Codex", foundBy: "program", reads: ["agents"] },
  { id: "cursor", name: "Cursor", foundBy: "folder", reads: ["agents", "claude"] },
  { id: "gemini", name: "Gemini CLI", foundBy: "program", reads: ["agents"] },
]

const SERVERS: Record<string, string[]> = { claude: ["memo", "tg-personal"], codex: ["tg-personal"] }
const SYNCED: Record<string, number> = { tg: 4, max: 9, wa: 6, zm: 38, drive: 22, memo: 15, email: 15 }

const T = SHOWCASE_TEXT[showcase ? showcaseLang() : "en"]
const LINES = T.lines
export const showcaseQuery = () => T.query

/** Swaps the stock mocks' English for the interface language: whole strings first, then names inside the rest. */
function localise<V>(value: V): V {
  if (typeof value === "string") {
    const whole = T.text[value] ?? value
    return T.names.reduce((s, [from, to]) => s.replaceAll(from, to), whole) as V
  }
  if (Array.isArray(value)) return value.map(localise) as V
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localise(v)])) as V
  return value
}

const sentAt = (i: number) => Date.UTC(2026, 9, 31, 19, 12) - i * 9.4 * 3600_000

function lisbonHit(i: number): SearchHit {
  const [chat, from, text] = LINES[i] as (typeof LINES)[number]
  return {
    ref: `msg:telegram/1/-100${2000 + chat}/${7000 + i}`,
    timestamp: new Date(sentAt(i)).toISOString(),
    chat_title: T.chats[chat]?.title,
    sender_name: from === "You" ? T.you : from,
    sender_is_me: from === "You",
    excerpt: text,
    matched_in: "text",
    score: Math.round((1 - i / 20) * 1000) / 1000,
    untrusted: ["chat_title", "sender_name", "excerpt"],
  }
}

function conversation(ref: string) {
  const i = Math.max(
    0,
    LINES.findIndex((_, n) => lisbonHit(n).ref === ref),
  )
  const [chat, sender, text] = LINES[i] as (typeof LINES)[number]
  const people = T.chats[chat]?.people ?? ["You"]
  const at = sentAt(i)
  return {
    items: Array.from({ length: 9 }, (_, n) => {
      const from = n === 4 ? sender : (people[n % people.length] ?? "You")
      return {
        ref: n === 4 ? ref : `${ref}-${n}`,
        timestamp: new Date(at + (n - 4) * 180_000).toISOString(),
        sender_name: from === "You" ? T.you : from,
        sender_is_me: from === "You",
        text: n === 4 ? text : T.around[n],
        attachments: [],
        anchor: n === 4 ? true : undefined,
      }
    }),
  }
}

const SESSIONS = [
  { kind: "claude-code", session_id: "3b8e51d2-7c4a-4f0e-9a61-0d2c5e7f1a94" },
  { kind: "codex", session_id: "019a4c7e-82f1-7d30-b6a5-3e9f0c1d2b74" },
  { kind: "claude-code", session_id: "a71f0c9e-25d8-4b3a-8e47-6c1d9b02f3e8" },
  { kind: "cursor", session_id: "6e2d9b14-0f3c-4a8e-b571-c49d2e8a0f63" },
]
const COMMANDS: Record<string, string[]> = {
  tg: ["chats list", "messages search", "inbox", "review"],
  max: ["chats list", "messages search"],
  wa: ["chats list", "messages search"],
  zm: ["meetings list", "meetings transcript"],
  drive: ["files list", "search"],
  memo: ["search all", "memories list"],
}

function runs(id: string, version: string): RunItem[] {
  const commands = COMMANDS[id] ?? []
  return Array.from({ length: commands.length * 3 }, (_, i) => {
    const command = commands[i % commands.length] ?? ""
    const started = Date.now() - (25 + i * 47 + id.length * 13) * MIN
    const duration = 180 + ((i * 397) % 1400)
    return {
      run_id: `showcase-${id}-${i}`,
      command,
      ...(id === "memo" ? {} : { profile: "personal" }),
      started_at: new Date(started).toISOString(),
      completed_at: new Date(started + duration).toISOString(),
      duration_ms: duration,
      status: "success",
      cli_version: version,
      requests: 1 + (i % 3),
      operations: [],
      codes: [],
      cli_command: `${findTool(id)?.bin ?? id} ${command}`,
      agent: SESSIONS[(i + id.length) % SESSIONS.length],
    }
  })
}

export function showcaseMock(base: Platform, installed: ReadonlyMap<string, string>): Partial<Platform> {
  const version = (id: string) => installed.get(ownerId(id)) ?? null
  return {
    async detectTools() {
      await delay(500)
      return tools.map(({ id, bin }) => ({
        id,
        installs: [{ path: `~/.local/share/pnpm/bin/${bin}`, version: version(id), manager: "pnpm", problem: null }],
      }))
    },
    async latestVersions() {
      await delay(400)
      return Object.fromEntries(tools.map((t) => [t.id, version(t.id)]))
    },
    async storeCompat(): Promise<StoreCompat> {
      await delay(300)
      const file = { version: 33, minCompatible: 32 }
      return {
        tools: [...installed.keys()].map((id) => ({
          id,
          outcome: "answered",
          speaks: 33,
          writable: true,
          reason: "current",
          upgrade: null,
          file,
          exists: true,
          problem: null,
        })),
        clients: [...installed].map(([command, v]) => ({ command, version: v, speaks: 33 })),
      }
    },
    async listProfiles(id) {
      await delay(300)
      return id === "memo" ? null : [{ name: "personal", signedIn: true }]
    },
    async syncLast(id) {
      await delay(200)
      return { at: ago((SYNCED[id] ?? 10) * MIN), left: null, known: true }
    },
    async notifications() {
      await delay(200)
      return []
    },
    async detectAgents() {
      await delay(300)
      return AGENTS
    },
    async skillStatus(id) {
      await delay(300)
      const v = version(id)
      return {
        source: "status",
        targets: (["claude", "agents"] as const).map((target) => ({
          target,
          path: `~/.${target}/skills/${findTool(id)?.bin ?? id}-cli/SKILL.md`,
          installed: v,
          state: "current",
        })),
      }
    },
    async terminalReach() {
      await delay(200)
      return Object.fromEntries([...installed.keys()].map((id) => [id, true]))
    },
    async mcpRegistrations(agent) {
      await delay(300)
      const canAdd = agent === "claude" || agent === "codex"
      return { source: "~/.claude.json", names: SERVERS[agent] ?? [], canAdd, canRemove: canAdd, unread: null }
    },
    async mcpCheck(id) {
      await delay(600)
      return { healthy: true, signedIn: true, tools: id === "tg" ? 41 : 23, potentialWrites: id === "tg" ? 9 : 4 }
    },
    async taskClaims(id) {
      await delay(400)
      const items =
        id === "tg"
          ? [
              {
                id: "t-1",
                key: "HRB-15",
                holder: `claude-code:${SESSIONS[0]?.session_id}`,
                until: new Date(Date.now() + 40 * MIN).toISOString(),
              },
            ]
          : []
      return { items, open: items.length + 3, more: false, signedOut: false }
    },
    async listRuns(id, _query, limit, page) {
      await delay(300)
      const all = runs(id, version(id) ?? "")
      return { items: all.slice((page - 1) * limit, page * limit), page: { has_more: all.length > page * limit } }
    },
    async taskList(query) {
      const answer = await base.taskList(query)
      if (answer.kind !== "ready") return answer
      const soon = new Date(Date.now() + 2 * 24 * 60 * MIN).toISOString()
      const late = (due: string | null, closed: string | null) => due && !closed && Date.parse(due) < Date.now()
      const tasks = answer.tasks.map((t) => (late(t.dueAt, t.closedAt) ? { ...t, dueAt: soon } : t))
      return localise({ ...answer, tasks })
    },
    taskShow: async (key) => localise(await base.taskShow(key)),
    taskCounts: async (query) => localise(await base.taskCounts(query)),
    peopleList: async () => localise(await base.peopleList()),
    projectList: async () => localise(await base.projectList()),
    memoryRead: async (...args) => localise(await base.memoryRead(...args)),
    memorySources: async (ref) => localise(await base.memorySources(ref)),
    async searchStore(id, profile, query, limit, page) {
      const answer = await base.searchStore(id, profile, query, limit, page)
      if (answer.kind !== "hits") return answer
      if (findTool(id)?.search?.what !== "messages") return { ...answer, notes: [] }
      return {
        kind: "hits",
        hits: LINES.map((_, i) => lisbonHit(i)),
        hasMore: false,
        paged: answer.paged,
        notes: [T.note],
        total: { value: LINES.length, relation: "eq" },
      }
    },
    async searchContext(id, profile, reference) {
      if (findTool(id)?.search?.what !== "messages") return base.searchContext(id, profile, reference)
      await delay(300)
      return { kind: "found", body: conversation(reference) }
    },
  }
}
