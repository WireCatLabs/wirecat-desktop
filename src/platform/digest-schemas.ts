import * as v from "valibot"
import { SECTION_ORDER } from "@/domain/digest"

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

const CHANNELS = ["telegram", "max", "whatsapp", "mail", "meeting", "task", "crm"] as const
export type Channel = (typeof CHANNELS)[number]
const isChannel = (kind: string): kind is Channel => (CHANNELS as readonly string[]).includes(kind)

// cli-core 0.678.0's channels: a CRM's own digest (`changes list --format report`) files its items under `crm`; memo
// files Drive and Calendar under these (a calendar event is a `meeting`). A channel a later one adds is shown without
// one, not as plain text.
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
      kind: v.picklist(SECTION_ORDER),
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
  /** The text is a document memo's check refused, not an older run's text. */
  refused: v.optional(v.boolean(), false),
  /** The field that check stopped at, when memo still keeps it. */
  invalid: v.nullish(v.string(), null),
})

export type DigestDay = v.InferOutput<typeof DigestDaySchema>
export type Report = v.InferOutput<typeof ReportSchema>
export type ReportItem = v.InferOutput<typeof ReportItemSchema>
export type Digest = v.InferOutput<typeof DigestSchema>
