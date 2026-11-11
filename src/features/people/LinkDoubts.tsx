import { Check, ChevronDown } from "lucide-react"
import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import type { Doubt } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pager } from "@/ui/Pager"
import { Skeleton } from "@/ui/Skeleton"
import { looksLikeEmail, WHATSAPP_PHONE } from "./contacts"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { SourceIcon, sourceOf } from "./sources"
import { DOUBTS_PAGE, usePeople } from "./store"

/**
 * `memo people links check` above the contacts: people whose accounts may not all be theirs, each a card with the reason,
 * the accounts, and what to do: confirm it, or take the suggested split.
 */
export function LinkDoubts() {
  const m = useMessages(peopleMessages)
  const doubts = usePeople((s) => s.doubts)
  const { readDoubts } = usePeople.getState()
  const [open, setOpen] = useState(true)
  const [kept, setKept] = useState<string | null>(null)
  const head = useId()
  const body = useId()
  const last = doubts?.last
  if (!doubts || (!last && doubts.state !== "failed") || (last && last.items.length === 0 && doubts.page === 1))
    return null

  return (
    <section
      aria-labelledby={head}
      className="flex flex-col gap-[0.75rem] rounded-[0.45rem] border border-line px-[1.1rem] py-[0.85rem]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id={head} className="flex items-center gap-2 font-semibold">
            <Lamp tone="warn" size="sm" />
            {m.doubtsTitle}
            {typeof last?.total === "number" && (
              <span className="font-normal text-ink-soft tabular-nums">· {m.doubtsCount(last.total)}</span>
            )}
          </h2>
          {open && <p className="mt-[0.15rem] text-[0.9rem] text-ink-soft">{m.doubtsHelp}</p>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={body}
          onClick={() => setOpen(!open)}
          icon={<ChevronDown className={open ? "size-4 rotate-180" : "size-4"} aria-hidden />}
        >
          {open ? m.doubtsHide : m.doubtsShow}
        </Button>
      </div>
      {open && (
        <div id={body} className="flex flex-col gap-[0.6rem]">
          <p role="status" className={kept ? "text-[0.9rem] text-ink-soft" : "sr-only"}>
            {kept && m.doubtKept(kept)}
          </p>
          {doubts.state === "failed" && (
            <ErrorNotice raw={doubts.error} inline>
              {m.doubtsFailed}
            </ErrorNotice>
          )}
          {last ? (
            <ul aria-busy={doubts.state === "loading"} className="flex flex-col gap-[0.6rem]">
              {last.items.map((doubt) => (
                <DoubtCard key={`${doubt.person}:${doubt.reason}`} doubt={doubt} onKept={setKept} />
              ))}
            </ul>
          ) : (
            <Skeleton className="h-[3rem] w-full" />
          )}
          {last && (doubts.page > 1 || last.more) && (
            <Pager
              page={doubts.page}
              label={m.doubtsPages}
              onPage={(page) => void readDoubts(page)}
              busy={doubts.state === "loading"}
              size={DOUBTS_PAGE}
              {...(last.total === null ? { hasMore: last.more } : { total: last.total })}
            />
          )}
        </div>
      )}
    </section>
  )
}

/** The account's own name, else its id only when a person can read it: an address or a phone, not a number or hash. */
function accountLabel(i: Doubt["identities"][number]) {
  if (i.name) return i.name
  const id = i.identity.slice(i.identity.indexOf(":") + 1)
  if (looksLikeEmail(id) && !id.endsWith(".whatsapp.net")) return id
  const phone = i.identity.startsWith("whatsapp:") ? WHATSAPP_PHONE.exec(id)?.[1] : /^\+\d{7,15}$/.exec(id)?.[0]
  return phone ?? null
}

function DoubtCard({ doubt, onKept }: { doubt: Doubt; onKept: (name: string) => void }) {
  const m = useMessages(peopleMessages)
  const { reveal, need, askSplit, askUndo, keep } = usePeople.getState()
  const busy = usePeople((s) => s.busy[doubt.person] === "keep")
  const failed = usePeople((s) => s.failed[doubt.person])
  const unlink = doubt.moves.find((x) => x.op === "unlink")
  const unmerge = doubt.moves.find((x) => x.op === "unmerge")
  const name = doubt.name ?? m.unknown
  const test = doubt.reason === "test-data"
  return (
    <li className="flex flex-col gap-[0.55rem] rounded-[0.45rem] border border-line bg-app px-[1rem] py-[0.8rem]">
      <div className="min-w-0">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => reveal(doubt.person)}
          className="rounded-[0.2rem] text-left font-medium text-ink underline decoration-line-strong underline-offset-[0.2em] hover:decoration-brand"
        >
          {name}
        </button>
        <p className="mt-[0.1rem] text-[0.92rem]">{m.doubtReasons[doubt.reason] ?? m.doubtOther}</p>
      </div>
      {doubt.identities.length > 0 && (
        <ul className="flex flex-wrap gap-x-[0.9rem] gap-y-[0.3rem]">
          {doubt.identities.map((i) => {
            const provider = i.identity.split(":")[0] ?? ""
            const source = sourceOf(provider).name
            return (
              <li key={i.identity} className="flex min-w-0 items-center gap-[0.4rem] text-[0.9rem]">
                <SourceIcon provider={provider} labelled />
                <span className="selectable min-w-0 truncate">{accountLabel(i) ?? m.anAccount(source)}</span>
              </li>
            )
          })}
        </ul>
      )}
      {test && <p className="text-[0.9rem] text-ink-soft">{m.doubtTestHelp}</p>}
      {!test && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            aria-busy={busy || undefined}
            icon={<Check className="size-4" aria-hidden />}
            onClick={() => {
              void keep(doubt.person).then((done) => done && onKept(name))
            }}
          >
            {busy ? m.doubtKeeping : m.doubtKeep}
          </Button>
          {unlink && (
            <Button
              size="sm"
              onClick={() => {
                need(doubt.person)
                askSplit(doubt.person, unlink.identities)
              }}
            >
              {m.doubtSplit}
            </Button>
          )}
          {unmerge && (
            <Button
              size="sm"
              onClick={() => {
                need(doubt.person)
                askUndo({ ref: doubt.person, merge: unmerge.merge })
              }}
            >
              {m.undo}
            </Button>
          )}
        </div>
      )}
      {failed && <Refusal error={failed} />}
    </li>
  )
}
