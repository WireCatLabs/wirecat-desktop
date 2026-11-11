import { Check, UserRound } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { cleanName, WHATSAPP_PHONE } from "@/domain/people"
import { useMessages } from "@/i18n"
import type { Doubt } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Lamp } from "@/ui/Lamp"
import { keepRoom, revealIfHidden } from "@/ui/motion"
import { Pager } from "@/ui/Pager"
import { Skeleton } from "@/ui/Skeleton"
import { looksLikeEmail } from "./contacts"
import { useKnownName } from "./labels"
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
  const box = useRef<HTMLElement>(null)
  const paging = useRef(false)
  const last = doubts?.last
  const ready = doubts?.state !== "loading"
  // A page of other cards is usually shorter: the panel's top comes back into view, not the page's.
  useEffect(() => {
    if (!ready || !paging.current) return
    paging.current = false
    revealIfHidden(box.current, "start")
  }, [ready])
  if (!doubts || (!last && doubts.state !== "failed") || (last && last.items.length === 0 && doubts.page === 1))
    return null

  return (
    <section
      ref={box}
      aria-labelledby={head}
      className="flex flex-col rounded-[0.45rem] border border-line px-[1.1rem] py-[0.85rem]"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={head} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-semibold">
          <Lamp tone="warn" size="sm" />
          {m.doubtsTitle}
          {typeof last?.total === "number" && (
            <span className="font-normal text-ink-soft tabular-nums">· {m.doubtsCount(last.total)}</span>
          )}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          aria-expanded={open}
          aria-controls={body}
          onClick={() => setOpen(!open)}
          icon={<ExpandChevron open={open} />}
        >
          {open ? m.doubtsHide : m.doubtsShow}
        </Button>
      </div>
      <Collapse open={open} id={body} className="flex flex-col gap-[0.6rem] pt-[0.4rem]">
        <p className="text-[0.9rem] text-ink-soft">{m.doubtsHelp}</p>
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
            onPage={(page) => {
              paging.current = true
              if (box.current) keepRoom(box.current)
              void readDoubts(page)
            }}
            busy={doubts.state === "loading"}
            size={DOUBTS_PAGE}
            {...(last.total === null ? { hasMore: last.more } : { total: last.total })}
          />
        )}
      </Collapse>
    </section>
  )
}

/** The account's own name, else its id only when a person can read it: an address or a phone, not a number or hash. */
function accountLabel(i: Doubt["identities"][number]) {
  const name = cleanName(i.name)
  if (name) return name
  const id = i.identity.slice(i.identity.indexOf(":") + 1)
  if (looksLikeEmail(id) && !id.endsWith(".whatsapp.net")) return id
  const phone = i.identity.startsWith("whatsapp:") ? WHATSAPP_PHONE.exec(id)?.[1] : /^\+\d{7,15}$/.exec(id)?.[0]
  return phone ?? null
}

function DoubtCard({ doubt, onKept }: { doubt: Doubt; onKept: (name: string) => void }) {
  const m = useMessages(peopleMessages)
  const { reveal, need, askSplit, askUndo, keep } = usePeople.getState()
  const known = useKnownName()
  const busy = usePeople((s) => s.busy[doubt.person] === "keep")
  const failed = usePeople((s) => s.failed[doubt.person])
  const unlink = doubt.moves.find((x) => x.op === "unlink")
  const unmerge = doubt.moves.find((x) => x.op === "unmerge")
  // memo's check gives the stored name, not its display_name: one with no letter («—») falls back as display_name does.
  const name =
    known(doubt.person) ?? cleanName(doubt.name) ?? doubt.identities.map(accountLabel).find(Boolean) ?? m.noName
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
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          aria-haspopup="dialog"
          icon={<UserRound className="size-4" aria-hidden />}
          onClick={() => reveal(doubt.person)}
        >
          {m.doubtOpen}
        </Button>
        {!test && (
          <>
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
          </>
        )}
      </div>
      {failed && <Refusal error={failed} />}
    </li>
  )
}
