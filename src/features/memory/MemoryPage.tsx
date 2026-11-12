import { ArrowRight, Check, ChevronDown, Plus, X } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import {
  byReviewRank,
  can,
  entryInTab,
  matchesFilter,
  memoryFilter,
  reviewRank,
  subjectOf,
  type Tab,
} from "@/domain/memory"
import { gapFromRead } from "@/domain/needs"
import { type Lang, useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { DemoNote } from "@/shared/DemoNote"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { EmptyState } from "@/ui/EmptyState"
import { InfoTip } from "@/ui/InfoTip"
import { keepRoom, MOTION, reducedMotion, scrollerOf } from "@/ui/motion"
import { Pager } from "@/ui/Pager"
import { RefreshButton } from "@/ui/RefreshButton"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { Activity } from "./Activity"
import { AddPanel, PANEL_TITLE } from "./AddPanel"
import { useAddSource } from "./add-store"
import { Filters } from "./Filters"
import { ForgetDialog } from "./ForgetDialog"
import { memoryMessages } from "./messages"
import { addMessages } from "./messages-add"
import { explainedMessages } from "./messages-explained"
import { findingsMessages } from "./messages-findings"
import { Row, SubjectLabel } from "./Row"
import { MEMORY_PAGE_SIZES, useMemory } from "./store"

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/memories`
const TABS: Tab[] = ["review", "inuse", "discarded", "all"]

export function MemoryPage() {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const lang = useLang()
  const s = useMemory()
  const gap = gapFromRead(s.read)
  const { load, visit, demo } = s

  useEffect(() => {
    if (!demo) visit()
  }, [visit, demo])

  const paging = usePaging()
  const ready = s.read?.kind === "ready" ? s.read : null
  const filter = memoryFilter(s.query)
  const filtered = s.entries.filter((e) => matchesFilter(e, filter))
  const inTab = filtered.filter((e) => entryInTab(s.tab, e) || s.held.includes(e.ref))
  const groups = bySubjectGroups(s.tab === "review" ? byReviewRank(inTab) : inTab, s.tab === "review")
  // A folded group takes one line of the page, its header; an open one a line per row.
  const slots: Slot[] = groups.flatMap((g) =>
    s.closedGroups.includes(g.key) ? [{ group: g }] : g.entries.map((entry) => ({ group: g, entry })),
  )
  const pages = Math.max(1, Math.ceil(slots.length / s.pageSize))
  const at = Math.min(s.page, pages)
  const onPage = slots.slice((at - 1) * s.pageSize, at * s.pageSize)
  const shown = onPage.flatMap((x) => (x.entry ? [x.entry] : []))
  // The clicked header keeps its page: folding a group that began on an earlier page goes back to it.
  const fold = (key: string) => {
    const page = Math.floor(slots.findIndex((x) => x.group.key === key) / s.pageSize) + 1
    s.toggleGroup(key)
    if (page === at) s.setPage(page)
    else paging.turn(s.setPage)(page)
  }
  const count = (tab: Tab) => filtered.filter((e) => entryInTab(tab, e)).length
  const forgetting = s.entries.find((e) => e.ref === s.forgetting) ?? null
  const filtering = s.query.trim() !== ""
  // On screen: this tab, these filters, a group that is not folded. Facts and memories only: a task, an agent's
  // findings batch and a relationship are approved in their own row.
  const approvable = shown.filter((e) => (e.type === "memory" || e.type === "fact") && !e.findings && can(e).confirm)

  return (
    <Page>
      <PageHeader
        title={m.title}
        section="memory"
        intro={x.intro}
        guide={{ label: m.guide, href: guide(lang) }}
        actions={
          s.read?.kind !== "missing" &&
          !demo && (
            <>
              {s.read?.kind === "ready" && <AddButton />}
              {!s.error && (
                <RefreshButton busy={s.reading} onClick={() => load()} label={m.readAgain} busyLabel={m.reading} />
              )}
            </>
          )
        }
      />

      {demo && <DemoNote />}
      <div inert={demo || undefined} className="contents">
        {s.error ? (
          <PageError raw={s.error} what="Reading memory" busy={s.reading} onRetry={() => load()}>
            {m.readFailed}
          </PageError>
        ) : gap ? (
          <ToolNeeded gap={gap} />
        ) : (
          <>
            {ready && <AddPanel />}
            <HowItWorks />
            <div className="flex flex-col gap-[1rem]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-[0.5rem]">
                  <Tabs value={s.tab} onChange={s.setTab} count={count} />
                  <p className="text-[0.92rem] text-ink-soft">{x.tabHint[s.tab]}</p>
                </div>
                <ApproveShown key={`${s.tab}|${s.query}`} refs={approvable.map((e) => e.ref)} />
              </div>
              <Filters />
            </div>

            <div
              ref={paging.list}
              aria-busy={paging.waiting || undefined}
              style={paging.height ? { minHeight: paging.height } : undefined}
              className={cx(
                "scroll-mt-[1rem] transition-opacity duration-(--motion-fast)",
                paging.waiting && "pointer-events-none opacity-55",
              )}
            >
              {s.read === null ? (
                <RackSkeleton />
              ) : s.entries.length === 0 ? (
                <EmptyState
                  title={m.emptyTitle}
                  action={
                    <Button size="sm" onClick={() => useNav.getState().go("agents")}>
                      {m.goAgents}
                    </Button>
                  }
                >
                  {m.emptyBody}
                </EmptyState>
              ) : (
                <Rack slots={onPage} groups={groups} tab={s.tab} filtering={filtering} onFold={fold} />
              )}
            </div>
            {slots.length > MEMORY_PAGE_SIZES[0] && (
              <Pager
                page={at}
                onPage={paging.turn(s.setPage)}
                total={slots.length}
                size={s.pageSize}
                sizes={MEMORY_PAGE_SIZES}
                onSize={s.setPageSize}
              />
            )}

            {ready?.linksError && (
              <PageError raw={ready.linksError} what="Reading memory links" busy={s.reading} onRetry={() => load()}>
                {m.linksFailed}
              </PageError>
            )}
            {ready?.page == null
              ? ready?.more && <p className="text-[0.9rem] text-ink-dim">{m.more}</p>
              : (ready.more || ready.page > 1) && (
                  <div className="flex flex-col gap-[0.5rem]">
                    <p className="text-[0.9rem] text-ink-dim">{m.memoPage(ready.page)}</p>
                    <Pager
                      page={ready.page}
                      onPage={paging.turn(s.turnMemoPage, true)}
                      hasMore={ready.more}
                      busy={s.reading}
                    />
                  </div>
                )}
            {ready && <Activity calls={ready.activity} error={ready.activityError} />}
          </>
        )}
      </div>

      <ForgetDialog entry={forgetting} />
    </Page>
  )
}

/** Brings the list's top into view once its new rows are drawn, only when it is above the view. */
const toListTop = (el: HTMLElement | null) =>
  requestAnimationFrame(() => {
    if (!el) return
    const view = scrollerOf(el)?.getBoundingClientRect().top ?? 0
    if (el.getBoundingClientRect().top < view)
      el.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" })
  })

/**
 * A page change keeps the reader on the list: the page keeps its room so nothing below jumps, the list keeps its
 * height while memo reads the next page, and the list's top comes into view once the new rows are there.
 */
function usePaging() {
  const list = useRef<HTMLDivElement>(null)
  const reading = useMemory((s) => s.reading)
  const [height, setHeight] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const settle = () => {
    toListTop(list.current)
    setTimeout(() => setHeight(null), reducedMotion() ? 0 : MOTION.progress + MOTION.normal)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: settle reads only the ref and setters
  useEffect(() => {
    if (pending && !reading) {
      setPending(false)
      settle()
    }
  }, [pending, reading])
  const turn =
    (go: (page: number) => void, read = false) =>
    (page: number) => {
      const el = list.current
      if (el) {
        keepRoom(el)
        setHeight(el.offsetHeight)
      }
      go(page)
      if (read) setPending(true)
      else settle()
    }
  return { list, turn, height: height ?? undefined, waiting: pending }
}

/** The page's one purple action; while the panel is open it steps back and only brings focus to the panel. */
function AddButton() {
  const m = useMessages(addMessages)
  const open = useAddSource((s) => s.open)
  return (
    <Button
      variant={open ? "secondary" : "primary"}
      size="sm"
      icon={<Plus className="size-4" aria-hidden />}
      aria-expanded={open}
      onClick={() => {
        if (!open) useAddSource.getState().openPanel()
        requestAnimationFrame(() => document.getElementById(PANEL_TITLE)?.focus({ preventScroll: !open }))
      }}
    >
      {m.open}
    </Button>
  )
}

function Rack({
  slots,
  groups,
  tab,
  filtering,
  onFold,
}: {
  slots: Slot[]
  groups: Group[]
  tab: Tab
  filtering: boolean
  onFold: (key: string) => void
}) {
  const m = useMessages(memoryMessages)
  const leaving = useMemory((s) => s.leaving)
  const arriving = useMemory((s) => s.arriving)
  const { setTab, setQuery } = useMemory.getState()

  if (slots.length === 0)
    return (
      <EmptyState
        action={
          filtering ? (
            <Button size="sm" onClick={() => setQuery("")}>
              {m.clearFilters}
            </Button>
          ) : (
            tab === "review" && (
              <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setTab("inuse")}>
                {m.showInUse}
              </Button>
            )
          )
        }
      >
        {filtering ? m.noMatch : m.nothing[tab]}
      </EmptyState>
    )

  return <SubjectRack slots={slots} groups={groups} leaving={leaving} arriving={arriving} onFold={onFold} />
}

type Group = { key: string; entries: MemoryEntry[]; waiting: number }
/** One line of a page: a row of an open group, or a folded group's header alone. */
type Slot = { group: Group; entry?: MemoryEntry }

/**
 * One run per subject: those with something waiting first, the run with no subject last, in Waiting for you the one
 * whose first record ranks highest, then the most recently touched.
 */
function bySubjectGroups(entries: MemoryEntry[], ranked: boolean): Group[] {
  const groups = new Map<string, Group>()
  for (const e of entries) {
    const key = subjectOf(e)?.key ?? ""
    const g = groups.get(key) ?? { key, entries: [], waiting: 0 }
    g.entries.push(e)
    if (e.status === "proposed") g.waiting++
    groups.set(key, g)
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.waiting > 0) - Number(a.waiting > 0) ||
      (b.key === "" ? -1 : 0) - (a.key === "" ? -1 : 0) ||
      (ranked ? rankOf(a) - rankOf(b) : 0) ||
      (b.entries[0]?.createdAt ?? "").localeCompare(a.entries[0]?.createdAt ?? ""),
  )
}

const rankOf = (g: Group) => (g.entries[0] ? reviewRank(g.entries[0]) : 2)

/** Approves every single row on screen; the count says how many, and the rows turn green where they are. */
function ApproveShown({ refs }: { refs: string[] }) {
  const m = useMessages(memoryMessages)
  const f = useMessages(findingsMessages)
  const [done, setDone] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  if (refs.length === 0 && done === null) return null
  if (refs.length === 0 && !running)
    return (
      <p role="status" className="reveal inline-flex items-center gap-2 text-[0.9rem] text-ink-soft">
        <Check className="size-4 text-ok" aria-hidden />
        {m.approvedShown(done ?? 0)}
      </p>
    )
  const approve = async () => {
    if (running) return
    setRunning(true)
    setDone(null)
    setDone(await useMemory.getState().confirmMany(refs))
    setRunning(false)
  }
  return (
    <span className="flex items-center gap-[0.35rem]">
      <Button size="sm" onClick={approve} busy={running} icon={<Check className="size-4" aria-hidden />}>
        {m.approveShown(refs.length)}
      </Button>
      <InfoTip label={f.approveAllAbout} align="end">
        {m.approveShownHint(refs.length)}
      </InfoTip>
    </span>
  )
}

/** One page of rows under their subjects; a subject's count is of all its rows, not only this page's. */
function SubjectRack({
  slots,
  groups,
  leaving,
  arriving,
  onFold,
}: {
  slots: Slot[]
  groups: Group[]
  leaving: string[]
  arriving: string[]
  onFold: (key: string) => void
}) {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const closed = useMemory((s) => s.closedGroups)
  const here = new Set(slots.map((s) => s.group.key))
  const onPage = new Set(slots.flatMap((s) => (s.entry ? [s.entry.ref] : [])))
  return (
    <section aria-label={m.rows} className="rounded-rack border border-line-strong bg-app">
      {groups.flatMap((whole) => {
        if (!here.has(whole.key)) return []
        const g = { ...whole, entries: whole.entries.filter((e) => onPage.has(e.ref)) }
        const subject = whole.entries[0] ? subjectOf(whole.entries[0]) : null
        const open = !closed.includes(g.key)
        return (
          <section key={g.key || "none"} className="border-line [&+&]:border-t">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-[1.3rem]">
              <h2 className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => onFold(g.key)}
                  className="group flex w-full cursor-pointer items-center gap-[0.7rem] pt-[1rem] pb-[0.6rem] pl-[1.3rem] text-left"
                >
                  <ChevronDown
                    className={cx(
                      "size-4 shrink-0 text-ink-dim transition-transform duration-(--motion-fast) group-hover:text-ink",
                      !open && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  {subject ? (
                    <SubjectLabel subject={subject} className="text-[1.05rem] font-semibold" />
                  ) : (
                    <span className="text-[1.05rem] font-semibold text-ink-soft">{m.noSubject}</span>
                  )}
                  <span className="shrink-0 text-[0.9rem] text-ink-dim">
                    {x.groupCount(whole.waiting, whole.entries.length)}
                  </span>
                </button>
              </h2>
              <GroupDecide entries={whole.entries} />
            </div>
            <Collapse open={open}>
              {g.entries.map((e) => (
                <Moving key={e.ref} leaving={leaving.includes(e.ref)} arriving={arriving.includes(e.ref)}>
                  <Row entry={e} />
                </Moving>
              ))}
            </Collapse>
          </section>
        )
      })}
    </section>
  )
}

/** A row unfolds into place when it is new and folds away when it is forgotten (rule 9), never a jump. */
function Moving({ leaving, arriving, children }: { leaving: boolean; arriving: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(!arriving)
  useEffect(() => {
    if (!shown) {
      const frame = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [shown])
  return <Collapse open={shown && !leaving}>{children}</Collapse>
}

function Tabs({ value, onChange, count }: { value: Tab; onChange: (t: Tab) => void; count: (t: Tab) => number }) {
  const m = useMessages(memoryMessages)
  return (
    <Segmented<Tab>
      size="md"
      label={m.show}
      value={value}
      onChange={onChange}
      options={TABS.map((t) => ({ value: t, label: t === "all" ? m.allTab : m.states[t], count: count(t) }))}
    />
  )
}

function RackSkeleton() {
  return (
    <div className="rounded-rack border border-line-strong bg-app">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-[4.5rem] items-center gap-[0.9rem] border-line px-[1.3rem] not-first:border-t">
          <Skeleton className="size-[1.4rem] rounded-full" />
          <Skeleton className="size-[1.6rem] rounded-pill" />
          <Skeleton className="h-[1rem] w-[60%]" />
        </div>
      ))}
    </div>
  )
}

/** Three steps that say what memory is for, before the first row: who writes, who decides, who uses it. */
function HowItWorks() {
  const x = useMessages(explainedMessages)
  return (
    <ol className="flex flex-col gap-[0.6rem] border-y border-line py-[0.8rem] sm:flex-row sm:items-start sm:gap-[0.4rem]">
      {x.how.map((step, i) => (
        <li key={step.title} className="flex min-w-0 flex-1 items-start gap-[0.6rem]">
          {i > 0 && <ArrowRight className="mt-[0.2rem] hidden size-4 shrink-0 text-ink-dim sm:block" aria-hidden />}
          <span className="min-w-0">
            <span className="block font-medium">
              <span className="mr-[0.4rem] font-mono text-[0.85rem] text-ink-dim">{i + 1}</span>
              {step.title}
            </span>
            <span className="block max-w-[34ch] text-[0.9rem] text-ink-soft">{step.body}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Approve or reject everything waiting in one group: a source that wrote a hundred links to one document is decided
 * in one go. A findings batch and an action are left to their own rows, where what they create is on screen.
 */
function GroupDecide({ entries }: { entries: MemoryEntry[] }) {
  const x = useMessages(explainedMessages)
  const [running, setRunning] = useState<"approve" | "reject" | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const waiting = entries.filter((e) => e.status === "proposed" && !e.findings && e.type !== "action").map((e) => e.ref)
  const said = result && (
    <p role="status" className="reveal text-[0.9rem] text-ink-soft">
      {result}
    </p>
  )
  if (waiting.length < 2) return said || null
  const decide = async (approve: boolean) => {
    if (running) return
    setRunning(approve ? "approve" : "reject")
    const { done, failed } = await useMemory.getState().decideMany(waiting, approve)
    setRunning(null)
    setResult(x.bulkDone(approve ? done : 0, approve ? 0 : done, failed))
  }
  return (
    <span className="flex shrink-0 items-center gap-2">
      {said}
      <Button
        size="sm"
        variant="ghost"
        disabled={!!running}
        title={x.rejectAllHint}
        onClick={() => void decide(false)}
        busy={running === "reject"}
        icon={<X className="size-4" aria-hidden />}
      >
        {x.rejectAll(waiting.length)}
      </Button>
      <Button
        size="sm"
        disabled={!!running}
        title={x.approveAllHint}
        onClick={() => void decide(true)}
        busy={running === "approve"}
        icon={<Check className="size-4" aria-hidden />}
      >
        {x.approveAll(waiting.length)}
      </Button>
    </span>
  )
}
