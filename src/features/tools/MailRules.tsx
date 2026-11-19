import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
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
import { Dialog } from "@/ui/Dialog"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { toListTop } from "@/ui/motion"
import { Pager } from "@/ui/Pager"
import { Pill } from "@/ui/Pill"
import { SearchField } from "@/ui/SearchField"
import { Skeleton } from "@/ui/Skeleton"
import { mailRulesMessages } from "./messages-mail-rules"

const PAGE = 25
const SKELETON_ROWS = 3
// Each search is a run of the tool: it waits until the owner stops typing, as People's search does. Clearing does not.
const TYPING_MS = 300

const countKey = (tool: string, profile: string) => ["tool", tool, "mail-rules", profile, "count"] as const

/** How many rules a mailbox has, for the button that opens them; null until known or when the tool cannot say. */
export function useMailRulesCount(tool: CatalogTool, profile: string): number | null {
  const read = useQuery({
    queryKey: countKey(tool.id, profile),
    queryFn: () => platform.mailRulesList(tool.id, profile, 1, 1),
    // Each read is a run of the tool; the dialog refreshes the count whenever it lists without a search.
    staleTime: 60_000,
  })
  return read.data?.result === "listed" ? read.data.total : null
}

/**
 * One mailbox's rules as mail-cli's `rules list` answers them, read only: what each matches, what it does and who made
 * it, searched and paged in a dialog. Rules are added and changed in a terminal, so the command to start from stays
 * above the list.
 */
export function MailRules(props: { tool: CatalogTool; profile: string; open: boolean; onClose: () => void }) {
  const { tool, profile, open, onClose } = props
  const m = useMessages(mailRulesMessages)
  const [typed, setTyped] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  // The last answer stays on screen while the next page or search is read, so the list and its pager do not jump.
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [busy, setBusy] = useState(true)
  const asked = useRef(0)
  const queries = useQueryClient()
  const list = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const seq = ++asked.current
    setBusy(true)
    let got: Answer
    try {
      got = await platform.mailRulesList(tool.id, profile, page, PAGE, query || undefined)
    } catch (e) {
      got = { result: "failed", message: errorText(e), code: null, reason: null }
    }
    // A slower answer to an older search or page must not replace the newer one.
    if (seq !== asked.current) return
    if (!query && got.result === "listed")
      queries.setQueryData(countKey(tool.id, profile), {
        result: "listed",
        rules: [],
        total: got.total,
      } satisfies Answer)
    setAnswer(got)
    setBusy(false)
  }, [tool.id, profile, page, query, queries])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  // Closed, it starts afresh next time; the dialog keeps showing what it had while it fades out.
  useEffect(() => {
    if (open) return
    asked.current++
    setTyped("")
    setQuery("")
    setPage(1)
    setAnswer(null)
  }, [open])

  useEffect(() => {
    const words = typed.trim()
    if (words === query) return
    const t = setTimeout(
      () => {
        setPage(1)
        setQuery(words)
      },
      words ? TYPING_MS : 0,
    )
    return () => clearTimeout(t)
  }, [typed, query])

  const tooOld = answer?.result === "failed" && answer.code === NEEDS_UPDATE
  const listed = answer?.result === "listed" ? answer : null

  return (
    <Dialog
      open={open}
      title={m.title(profile)}
      onClose={onClose}
      wide
      scroll
      tall
      footer={
        listed && listed.total > PAGE ? (
          <Pager
            page={page}
            onPage={(p) => {
              setPage(p)
              toListTop(list.current)
            }}
            busy={busy}
            total={listed.total}
            size={PAGE}
            label={m.pages}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 pb-3">
        <p className="max-w-[65ch] text-[0.9rem] leading-snug">{m.what}</p>
        {!tooOld && (
          <div className="flex flex-col gap-1.5">
            <p className="max-w-[65ch] text-[0.85rem] leading-snug">{m.addHint}</p>
            <CopyField wrap label={m.addLabel} value={`${tool.bin} ${profile} rules add --do meeting-notes:telemost`} />
          </div>
        )}
        {!tooOld && (
          // Stays at the top while the rules scroll under it.
          <div className="sticky top-0 z-10 -mx-1 bg-app px-1 pt-1 pb-1">
            <SearchField value={typed} onChange={setTyped} label={m.search} placeholder={m.searchHint} focusFirst />
          </div>
        )}

        {/* Below the search field that stays on top, when a new page brings the list's top into view. */}
        <div ref={list} className="scroll-mt-[3.6rem]">
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
            ) : answer.total === 0 && query ? (
              <EmptyState
                busy={busy}
                title={m.nothingFound}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setTyped("")}>
                    {m.clearSearch}
                  </Button>
                }
              >
                {m.nothingFoundText(query)}
              </EmptyState>
            ) : answer.total === 0 ? (
              <EmptyState busy={busy} title={m.none}>
                {m.noneText}
              </EmptyState>
            ) : (
              <ul
                aria-busy={busy || undefined}
                className={cx(
                  "divide-y divide-line overflow-hidden rounded-button border border-line bg-app transition-opacity duration-(--motion-normal)",
                  busy && "opacity-60",
                )}
              >
                {answer.rules.map((rule, i) => (
                  <RuleRow key={rule.id ?? `n${i}`} rule={rule} />
                ))}
              </ul>
            )}
          </AutoHeight>
        </div>
      </div>
    </Dialog>
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
