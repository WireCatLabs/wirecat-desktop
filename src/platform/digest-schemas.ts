import * as v from "valibot"

// `digests.rs` reads memo's run files; the document is cli-core's checked `wirecat.report/1`, read again here because
// it comes from a file another program wrote. Unknown fields are dropped; a newer section kind or item type fails
// the whole document, which then shows as the run's text.

export const DigestDaySchema = v.object({
  date: v.string(),
  stamp: v.string(),
  summary: v.nullable(v.string()),
  report: v.boolean(),
  /** Built later by `digest backfill` for a past day; never delivered. */
  backfill: v.optional(v.boolean(), false),
})

const text = v.nullish(v.string(), null)
const moment = v.nullish(v.string(), null)
const refs = v.nullish(v.array(v.string()), [])

export const CHANNELS = ["telegram", "max", "whatsapp", "mail", "meeting", "task"] as const
type Channel = (typeof CHANNELS)[number]
const isChannel = (kind: string): kind is Channel => (CHANNELS as readonly string[]).includes(kind)

// memo 0.132.0's digest reads Drive, Calendar and a CRM but files them under these channels (a calendar event is a
// `meeting`), as cli-core 0.643.0 checks them. A channel a later one adds is shown without one, not as plain text.
const channel = v.fallback(v.nullish(v.picklist(CHANNELS), null), null)

export const ReportItemSchema = v.object({
  type: v.picklist(["reply", "question", "task", "fact", "risk", "money", "decision", "meeting"]),
  who: text,
  topic: text,
  action: text,
  detail: text,
  quote: text,
  since: moment,
  due: moment,
  time: moment,
  amount: v.nullish(v.object({ value: v.number(), currency: v.string(), direction: v.picklist(["in", "out"]) }), null),
  count: v.nullish(v.number(), null),
  priority: v.nullish(v.picklist(["high", "normal"]), "normal"),
  channel,
  refs,
})

export const ReportSchema = v.object({
  format: v.literal("wirecat.report/1"),
  kind: v.literal("morning-digest"),
  date: v.string(),
  summary: text,
  sections: v.array(
    v.object({
      kind: v.picklist(["today", "decisions", "money", "meetings", "projects", "mail"]),
      items: v.array(ReportItemSchema),
      more: v.nullish(v.number(), 0),
    }),
  ),
  health: v.nullish(
    v.array(
      v.object({
        source: v.string(),
        account: text,
        reason: v.nullish(v.picklist(["sync-failed", "no-schedule", "quiet"]), null),
        since: moment,
        stale_hours: v.nullish(v.number(), 0),
        refs,
      }),
    ),
    [],
  ),
  scope: v.nullish(
    v.object({
      from: v.string(),
      to: v.string(),
      sources: v.pipe(
        v.array(v.object({ kind: v.string(), accounts: v.number() })),
        v.transform((all) => all.flatMap(({ kind, accounts }) => (isChannel(kind) ? [{ kind, accounts }] : []))),
      ),
      counts: v.object({ chats: v.number(), mail: v.number(), tasks: v.number(), meetings: v.number() }),
    }),
    null,
  ),
  tasks: v.nullish(
    v.object({
      overdue: v.number(),
      today: v.number(),
      tomorrow: v.number(),
      new: v.number(),
      new_since: moment,
    }),
    null,
  ),
})

export const DigestSchema = v.object({
  date: v.string(),
  stamp: v.string(),
  document: v.nullable(v.unknown()),
  text: v.nullable(v.string()),
})

export type DigestDay = v.InferOutput<typeof DigestDaySchema>
export type Report = v.InferOutput<typeof ReportSchema>
export type ReportItem = v.InferOutput<typeof ReportItemSchema>
export type Digest = v.InferOutput<typeof DigestSchema>
