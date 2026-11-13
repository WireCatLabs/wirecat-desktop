import type { MailRule, MailRules } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// mail-cli's `rules list` on Email's accounts (`?accounts=email`, then "Mail rules" in an account's menu): a protected
// sender, Telemost meeting notes, an envelope rule with what it recorded, a built-in kind and a Gmail filter.
// `?mail-rules=none` has no rules, `fail` refuses (another sync holds the store), `old` is a mail-cli without
// `rules list`, `many` has 60 rules, so the list pages.
const rule = (over: Partial<MailRule> & Pick<MailRule, "conditions" | "action">): MailRule => ({
  id: null,
  tags: [],
  reason: null,
  protected: false,
  meetingNotes: null,
  source: null,
  decidedAt: "2026-11-02T09:30:00.000Z",
  recorded: null,
  ...over,
})

const RULES: MailRule[] = [
  rule({
    id: 4,
    conditions: [{ key: "from", value: "boss@example.com" }],
    action: "keep",
    protected: true,
    reason: "Never lose these",
    decidedAt: "2026-10-20T08:00:00.000Z",
  }),
  rule({
    id: 7,
    conditions: [{ key: "from", value: "keeper@telemost.yandex.ru" }],
    action: "keep",
    meetingNotes: "telemost",
    source: "owner",
    decidedAt: "2026-11-13T07:45:00.000Z",
  }),
  rule({
    id: 2,
    conditions: [
      { key: "domain", value: "shop.example" },
      { key: "older_than_days", value: "365" },
    ],
    action: "envelope",
    tags: ["promo"],
    recorded: { emails: 214, bytes: 18_350_080 },
  }),
  rule({
    id: 3,
    conditions: [{ key: "preset", value: "social" }],
    action: "skip",
    source: "preset:social",
    decidedAt: "2026-09-14T10:00:00.000Z",
  }),
  rule({
    id: 5,
    conditions: [{ key: "list_id", value: "weekly.news.example.org" }],
    action: "skip",
    source: "gmail-filter",
    decidedAt: "2026-09-01T12:00:00.000Z",
  }),
]

const many = (): MailRule[] =>
  Array.from({ length: 60 }, (_, i) =>
    rule({
      id: 100 + i,
      conditions: [{ key: "domain", value: `news${i + 1}.example.test` }],
      action: i % 3 === 0 ? "skip" : "envelope",
      source: "probe",
    }),
  )

export function mailRulesMock(params: URLSearchParams): Pick<Platform, "mailRulesList"> {
  const scenario = params.get("mail-rules")
  return {
    async mailRulesList(_id, _profile, page, limit): Promise<MailRules> {
      await delay(500)
      if (scenario === "old")
        return { result: "failed", code: "needs_update", reason: null, message: "error: unknown command 'rules'" }
      if (scenario === "fail")
        return {
          result: "failed",
          code: "store_busy",
          reason: "store.locked",
          message: "another mail sync holds the store; try again when it ends",
        }
      const all = scenario === "none" ? [] : scenario === "many" ? many() : RULES
      return { result: "listed", rules: all.slice((page - 1) * limit, page * limit), total: all.length }
    },
  }
}
