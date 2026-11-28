import type { InboxAccount, InboxPage, InboxRun, InboxThread, SyncSchedule } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// mail-cli's `inbox` on Email's two accounts, personal and work, for the Inbox tab of Digests (`?section=inbox`).
// `?inbox=on`: both have mail sorted by the AI model in all three groups; `?inbox=empty`: nothing sorted yet;
// `?inbox=new`: work has never synced, so its read is refused; `?inbox=fail`: work's read is refused because a sync holds
// the store; `?inbox=old`: mail-cli 0.34, before `inbox`. Sort now sorts two new threads in personal and none in
// work. `?inbox-run=ask`: the model is outside this computer and memo asks first, so a run without yes is refused with
// what it would send; `?inbox-run=partial`: personal's run leaves threads for the next one; `?inbox-run=fail`: the run
// is refused because no key is stored for the model. `?inbox-schedule=on`: personal sorts on its own every hour.

type Mocked = "mailInboxList" | "mailInboxRun" | "mailInboxScheduleStatus" | "mailInboxScheduleSet"

const HOUR = 3_600_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const BY = "anthropic/claude-haiku-4-5"
const MAILBOX: Record<string, string> = { personal: "anna%40example.com", work: "anna%40acme.example" }

const thread = (
  profile: string,
  n: number,
  bucket: InboxThread["bucket"],
  title: string | null,
  reason: string,
  hours: number,
  sender: InboxThread["sender"] = null,
): InboxThread => ({
  profile,
  ref: `chat:email/${MAILBOX[profile] ?? profile}/thread-${n}`,
  title,
  bucket,
  reason,
  lastEmailAt: ago(hours * HOUR),
  sortedAt: ago(Math.max(0, hours - 0.5) * HOUR),
  by: BY,
  sender,
})

const SORTED: InboxThread[] = [
  thread("work", 1, "answer", "Contract draft for the Lisbon office", "Marta asks you to sign by Friday", 3, {
    name: "Marta Silva",
    address: "marta@acme.example",
  }),
  thread("personal", 2, "answer", "Dinner on Saturday?", "Your brother asks if 8 pm works", 5, {
    name: null,
    address: "leo@example.com",
  }),
  thread("work", 3, "answer", "Re: Q4 budget", "Paul waits for your numbers before the board call", 26),
  thread("work", 4, "read", "Release notes 2.14", "What changed in the app your team uses", 7),
  thread("personal", 5, "read", "Your flight to Valencia", "Boarding pass and the gate change", 20),
  thread("work", 6, "read", null, "A long reply in the hiring thread, no question for you", 30),
  thread("personal", 7, "later", "Invoice 2026-118", "A receipt, already paid", 9),
  thread("work", 8, "later", "Weekly digest from Linear", "A newsletter", 40),
  thread("personal", 9, "later", "Black Friday at the bike shop", "An offer", 50),
]

const FRESH: InboxThread[] = [
  thread("personal", 10, "answer", "Keys for the flat", "The landlord asks when you can meet", 0.2),
  thread("personal", 11, "later", "Your parcel is on its way", "A delivery notice", 0.3),
]

const matches = (t: InboxThread, words: string[]) => {
  const text = `${t.title ?? ""} ${t.reason}`.toLocaleLowerCase()
  return words.every((w) => text.includes(w.toLocaleLowerCase()))
}

const RANK = { answer: 0, read: 1, later: 2 } as Record<string, number>

export function mailInboxMock(params: URLSearchParams): Pick<Platform, Mocked> {
  const scenario = params.get("inbox")
  const runScenario = params.get("inbox-run")
  let threads = scenario === "empty" ? [] : [...SORTED]
  const schedules = new Map<string, SyncSchedule>(
    params.get("inbox-schedule") === "on"
      ? [["personal", { state: "on", when: "every 1h", every: "1h", daily: null, last: null }]]
      : [],
  )
  const refused = (profile: string): InboxAccount | null => {
    if (profile !== "work") return null
    if (scenario === "new")
      return {
        result: "failed",
        profile,
        code: "not_found",
        reason: "item.not-found",
        message: "no mail is stored yet; run `mail work sync` first",
      }
    if (scenario === "fail")
      return {
        result: "failed",
        profile,
        code: "store_busy",
        reason: "store.locked",
        message: "another mail sync holds the store; try again when it ends",
      }
    return null
  }
  return {
    async mailInboxList(_id, profiles, filter, page, limit): Promise<InboxPage> {
      await delay(500)
      const accounts: InboxAccount[] = profiles.map(
        (profile) =>
          refused(profile) ?? {
            result: "listed",
            profile,
            matching: threads.filter((t) => t.profile === profile && matches(t, filter.words)).length,
          },
      )
      const readable = new Set(accounts.filter((a) => a.result === "listed").map((a) => a.profile))
      const chosen = threads
        .filter((t) => readable.has(t.profile) && (filter.accounts.length === 0 || filter.accounts.includes(t.profile)))
        .filter((t) => matches(t, filter.words))
        .sort((a, b) => (RANK[a.bucket] ?? 3) - (RANK[b.bucket] ?? 3) || b.lastEmailAt.localeCompare(a.lastEmailAt))
      const count = (bucket: string) => chosen.filter((t) => t.bucket === bucket).length
      return {
        threads: chosen.slice((page - 1) * limit, page * limit),
        total: chosen.length,
        buckets: { answer: count("answer"), read: count("read"), later: count("later") },
        accounts,
      }
    },
    async mailInboxRun(_id, profile, yes): Promise<InboxRun> {
      await delay(2500)
      if (scenario === "old")
        return {
          result: "failed",
          code: "needs_update",
          reason: null,
          message: "error: unknown command 'inbox'",
          ask: null,
        }
      const no = refused(profile)
      if (no?.result === "failed")
        return { result: "failed", message: no.message, code: no.code, reason: no.reason, ask: null }
      if (runScenario === "fail")
        return {
          result: "failed",
          code: "configuration_error",
          reason: "ai.key-missing",
          message: "no API key is stored for the AI model: store it with `wcat models ai set … --secret-stdin`",
          ask: null,
        }
      if (runScenario === "ask" && !yes)
        return {
          result: "failed",
          code: "permission_error",
          reason: "chat-sending.ask",
          message: `8 emails of 5 threads (about 3100 tokens) go to ${BY} at api.anthropic.com, and wcat models chats asks first`,
          ask: { emails: 8, threads: 5, tokens: 3100, host: "api.anthropic.com", model: BY, estimatedCostUsd: 0.004 },
        }
      const fresh = profile === "personal" ? FRESH.filter((f) => !threads.some((t) => t.ref === f.ref)) : []
      threads = [...fresh, ...threads]
      const notes =
        runScenario === "partial" && profile === "personal"
          ? ["14 threads wait for the next run: --max-messages was reached; `mail inbox` again sorts them"]
          : []
      return {
        result: "sorted",
        listed: threads.filter((t) => t.profile === profile).length,
        notes,
        complete: notes.length === 0,
        model: BY,
        costUsd: fresh.length > 0 ? 0.0031 : null,
      }
    },
    async mailInboxScheduleStatus(_id, profile) {
      await delay(300)
      return schedules.get(profile) ?? { state: "off" }
    },
    async mailInboxScheduleSet(_id, profile, every) {
      await delay(700)
      const next: SyncSchedule = every
        ? { state: "on", when: `every ${every}`, every, daily: null, last: null }
        : { state: "off" }
      schedules.set(profile, next)
      return next
    },
  }
}
