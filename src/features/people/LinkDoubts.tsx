import { Check, EyeOff, Unlink, UserRound } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { cleanName, fullerName, WHATSAPP_PHONE } from "@/domain/people"
import { useMessages } from "@/i18n"
import type { Doubt } from "@/platform/people-schemas"
import { safeStorage } from "@/shared/safe-storage"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Lamp } from "@/ui/Lamp"
import { LinkButton } from "@/ui/LinkButton"
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
 * Test data the owner put aside on this computer. memo keeps listing test data and has no answer that clears it
 * (`people links resolve` refuses it), so this hides the card here and nothing more.
 */
const useSetAside = create<{ hidden: string[]; hide(key: string): void; showAll(): void }>()(
  persist(
    (set) => ({
      hidden: [],
      hide: (key) => set((s) => ({ hidden: [...s.hidden.filter((k) => k !== key), key].slice(-500) })),
      showAll: () => set({ hidden: [] }),
    }),
    { name: "wirecat.people-test-data", storage: createJSONStorage(() => safeStorage) },
  ),
)

/** A new test account on the same person brings the card back. */
const asideKey = (doubt: Doubt) =>
  `${doubt.person}|${doubt.identities
    .map((i) => i.identity)
    .sort()
    .join(" ")}`

/**
 * `memo people links check` above the contacts: people whose accounts may not all be theirs, each a card with the reason,
 * the accounts, and what to do: confirm it, or take the suggested split.
 */
export function LinkDoubts() {
  const m = useMessages(peopleMessages)
  const doubts = usePeople((s) => s.doubts)
  const { readDoubts } = usePeople.getState()
  const [open, setOpen] = useState(true)
  const [said, setSaid] = useState<string | null>(null)
  const head = useId()
  const body = useId()
  const box = useRef<HTMLElement>(null)
  const paging = useRef(false)
  const hidden = useSetAside((s) => s.hidden)
  const last = doubts?.last
  const ready = doubts?.state !== "loading"
  const aside = last?.items.filter((d) => d.reason === "test-data" && hidden.includes(asideKey(d))).length ?? 0
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
        <p role="status" className={said ? "text-[0.9rem] text-ink-soft" : "sr-only"}>
          {said}
        </p>
        {doubts.state === "failed" && (
          <ErrorNotice raw={doubts.error} inline>
            {m.doubtsFailed}
          </ErrorNotice>
        )}
        {last ? (
          <ul aria-busy={doubts.state === "loading"} className="flex flex-col gap-[0.6rem]">
            {last.items
              .filter((d) => d.reason !== "test-data" || !hidden.includes(asideKey(d)))
              .map((doubt) => (
                <DoubtCard key={`${doubt.person}:${doubt.reason}`} doubt={doubt} onDone={setSaid} />
              ))}
          </ul>
        ) : (
          <Skeleton className="h-[3rem] w-full" />
        )}
        {aside > 0 && (
          <p className="text-[0.9rem] text-ink-soft">
            {m.doubtsAside(aside)}{" "}
            <LinkButton onClick={() => useSetAside.getState().showAll()}>{m.doubtsShowAside}</LinkButton>
          </p>
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

/** `onDone` gets the sentence that says what the owner's answer did: the card itself leaves with the next read. */
function DoubtCard({ doubt, onDone }: { doubt: Doubt; onDone: (said: string) => void }) {
  const m = useMessages(peopleMessages)
  const { reveal, need, askSplit, askUndo, keep } = usePeople.getState()
  const known = useKnownName()
  const busy = usePeople((s) => s.busy[doubt.person])
  const failed = usePeople((s) => s.failed[doubt.person])
  const detail = usePeople((s) => s.details[doubt.person])
  const unlink = doubt.moves.find((x) => x.op === "unlink")
  const unmerge = doubt.moves.find((x) => x.op === "unmerge")
  const labels = doubt.identities.map(accountLabel)
  // memo's check gives the stored name, not its display_name: one with no letter («—») falls back as display_name does.
  const name =
    fullerName(
      known(doubt.person) ?? cleanName(doubt.name),
      doubt.identities.map((i) => i.name),
    ) ??
    labels.find(Boolean) ??
    m.noName
  const test = doubt.reason === "test-data"
  // memo lists only the test accounts: the person may hold real ones too, and those stay when the test ones leave.
  useEffect(() => {
    if (test) need(doubt.person)
  }, [test, need, doubt.person])
  const testIds = doubt.identities.map((i) => i.identity)
  const person = detail?.state === "ready" ? detail.person : null
  const movable = person?.identities.filter((i) => testIds.includes(i.identity) && i.movable).map((i) => i.identity)
  const realToo = !!person && person.identities.some((i) => !testIds.includes(i.identity))
  const canSeparate = realToo && !!movable && movable.length === testIds.length
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
      {test && (
        <p className="text-[0.9rem] text-ink-soft">
          {canSeparate ? m.doubtTestSeparateHelp : person ? m.doubtTestOnlyHelp : m.doubtTestHelp}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          aria-haspopup="dialog"
          icon={<UserRound className="size-4" aria-hidden />}
          onClick={() => reveal(doubt.person)}
        >
          {m.doubtOpen}
        </Button>
        {test && canSeparate && (
          <Button
            size="sm"
            aria-busy={busy === "unlink" || undefined}
            disabled={!!busy}
            icon={<Unlink className="size-4" aria-hidden />}
            onClick={() =>
              void usePeople
                .getState()
                .unlink(doubt.person, testIds)
                .then((done) => done && onDone(m.doubtSeparated(name)))
            }
          >
            {m.doubtSeparateTest}
          </Button>
        )}
        {test && (
          <Button
            size="sm"
            icon={<EyeOff className="size-4" aria-hidden />}
            onClick={() => {
              useSetAside.getState().hide(asideKey(doubt))
              onDone(m.doubtPutAside(name))
            }}
          >
            {m.doubtSetAside}
          </Button>
        )}
        {!test && (
          <>
            <Button
              size="sm"
              aria-busy={busy === "keep" || undefined}
              icon={<Check className="size-4" aria-hidden />}
              onClick={() => {
                void keep(doubt.person).then((done) => done && onDone(m.doubtKept(name)))
              }}
            >
              {busy === "keep" ? m.doubtKeeping : m.doubtKeep}
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
