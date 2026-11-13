import { X } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { matchWords, ruleMaker } from "@/domain/mail-rules"
import { formatDate, formatList, useLang, useMessages } from "@/i18n"
import type { MailRules as Answer, MailRule } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { NEEDS_UPDATE } from "@/shared/signin-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pager } from "@/ui/Pager"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { mailRulesMessages } from "./messages-mail-rules"

const PAGE = 25
const SKELETON_ROWS = 3

/**
 * One mailbox's rules as mail-cli's `rules list` answers them, read only: what each matches, what it does and who made
 * it. Rules are added and changed in a terminal, so the command to start from stays above the list.
 */
export function MailRules(props: { tool: CatalogTool; profile: string; onClose: () => void }) {
  const { tool, profile, onClose } = props
  const m = useMessages(mailRulesMessages)
  const heading = useId()
  const [page, setPage] = useState(1)
  // The last answer stays on screen while the next page is read, so the list and its pager do not jump.
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [busy, setBusy] = useState(true)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setAnswer(await platform.mailRulesList(tool.id, profile, page, PAGE))
    } catch (e) {
      setAnswer({ result: "failed", message: errorText(e), code: null, reason: null })
    }
    setBusy(false)
  }, [tool.id, profile, page])

  useEffect(() => {
    void load()
  }, [load])

  const tooOld = answer?.result === "failed" && answer.code === NEEDS_UPDATE

  return (
    <section
      aria-labelledby={heading}
      className="reveal flex flex-col gap-3 rounded-inset border border-line bg-app-2/60 p-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h5 id={heading} className="text-[0.95rem] font-semibold text-ink">
            {m.title(profile)}
          </h5>
          <p className="max-w-[65ch] text-[0.9rem] leading-snug text-ink-soft">{m.what}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label={m.close}
          title={m.close}
          icon={<X className="size-4" aria-hidden />}
        />
      </div>

      {!tooOld && (
        <div className="flex flex-col gap-1.5">
          <p className="max-w-[65ch] text-[0.85rem] leading-snug text-ink-soft">{m.addHint}</p>
          <CopyField wrap label={m.addLabel} value={`${tool.bin} ${profile} rules add --meeting-notes telemost`} />
        </div>
      )}

      <AutoHeight swap={answer === null ? "loading" : answer.result}>
        {answer === null ? (
          <ul className="divide-y divide-line overflow-hidden rounded-button border border-line bg-app" aria-busy>
            <li className="sr-only" role="status">
              {m.loading}
            </li>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders with nothing to tell them apart
              <li key={i} className="flex flex-col gap-1.5 px-3 py-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </li>
            ))}
          </ul>
        ) : answer.result === "failed" ? (
          <ErrorNotice
            inline
            raw={tooOld ? null : answer.message}
            action={
              tooOld ? undefined : (
                <Button size="sm" variant="secondary" onClick={load}>
                  {m.retry}
                </Button>
              )
            }
          >
            {tooOld ? m.needsUpdate : m.listFailed}
          </ErrorNotice>
        ) : answer.total === 0 ? (
          <EmptyState title={m.none}>{m.noneText}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2" aria-busy={busy || undefined}>
            <ul
              className={cx(
                "divide-y divide-line overflow-hidden rounded-button border border-line bg-app transition-opacity duration-(--motion-normal)",
                busy && "opacity-60",
              )}
            >
              {answer.rules.map((rule, i) => (
                <RuleRow key={rule.id ?? `n${i}`} rule={rule} />
              ))}
            </ul>
            {answer.total > PAGE && (
              <Pager page={page} onPage={setPage} busy={busy} total={answer.total} size={PAGE} label={m.pages} />
            )}
          </div>
        )}
      </AutoHeight>
    </section>
  )
}

function RuleRow({ rule }: { rule: MailRule }) {
  const m = useMessages(mailRulesMessages)
  const lang = useLang()
  const maker = ruleMaker(rule.source)
  const decided = Date.parse(rule.decidedAt)
  const details = [
    maker.by === "other" ? m.otherMaker(maker.source) : m.maker[maker.by],
    Number.isNaN(decided) ? null : formatDate(decided, { dateStyle: "medium" }, lang),
    rule.recorded ? m.recorded(rule.recorded.emails, rule.recorded.bytes) : null,
    rule.tags.length > 0 ? m.tags(rule.tags.join(", ")) : null,
  ].filter((part): part is string => part !== null)
  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 text-[0.95rem] break-words text-ink">
          {matchWords(rule.conditions, m.match, (parts) => formatList(parts, lang))}
        </span>
        <Pill tone={rule.action === "skip" ? "neutral" : "brand"}>{m.action[rule.action] ?? rule.action}</Pill>
        {rule.protected && <Pill tone="warn">{m.protected}</Pill>}
        {rule.meetingNotes && <Pill tone="brand">{m.meetingNotes(rule.meetingNotes)}</Pill>}
      </div>
      <p className="text-[0.85rem] leading-snug text-ink-dim">{details.join(" · ")}</p>
      {rule.reason && <p className="text-[0.85rem] leading-snug text-ink-soft">{rule.reason}</p>}
    </li>
  )
}
