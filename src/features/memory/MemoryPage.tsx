import { ArrowRight, Check, ChevronDown, ExternalLink, LoaderCircle, Plus, RefreshCw, X } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { can, entryInTab, matchesFilter, memoryFilter, subjectOf, type Tab } from "@/domain/memory"
import { gapFromRead } from "@/domain/needs"
import { ToolNeeded } from "@/features/tools"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { DemoNote } from "@/shared/DemoNote"
import { useNav } from "@/shared/nav"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { Skeleton } from "@/ui/Skeleton"
import { Activity } from "./Activity"
import { AddPanel, PANEL_TITLE } from "./AddPanel"
import { useAddSource } from "./add-store"
import { Filters } from "./Filters"
import { ForgetDialog } from "./ForgetDialog"
import { memoryMessages } from "./messages"
import { addMessages } from "./messages-add"
import { explainedMessages } from "./messages-explained"
import { Row, SubjectLabel } from "./Row"
import { useMemory } from "./store"

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/memories`
const TABS: Tab[] = ["review", "inuse", "discarded", "all"]

export function MemoryPage() {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const lang = useLang()
  const s = useMemory()
  const gap = gapFromRead(s.read)
  const { load, demo } = s

  useEffect(() => {
    if (!demo) load()
  }, [load, demo])

  const ready = s.read?.kind === "ready" ? s.read : null
  const filter = memoryFilter(s.query)
  const filtered = s.entries.filter((e) => matchesFilter(e, filter))
  const groups = bySubjectGroups(filtered.filter((e) => entryInTab(s.tab, e) || s.held.includes(e.ref)))
  const ordered = groups.flatMap((g) => g.entries)
  const pages = Math.max(1, Math.ceil(ordered.length / s.pageSize))
  const at = Math.min(s.page, pages)
  const shown = ordered.slice((at - 1) * s.pageSize, at * s.pageSize)
  const count = (tab: Tab) => filtered.filter((e) => entryInTab(tab, e)).length
  const forgetting = s.entries.find((e) => e.ref === s.forgetting) ?? null
  const filtering = s.query.trim() !== ""
  // On screen: this tab, these filters, a group that is not folded. Facts and memories only: a task, an agent's
  // findings batch and a relationship are approved in their own row.
  const approvable = shown.filter(
    (e) =>
      (e.type === "memory" || e.type === "fact") &&
      !e.findings &&
      can(e).confirm &&
      !s.closedGroups.includes(subjectOf(e)?.key ?? ""),
  )

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            {x.intro}{" "}
            <a
              href={guide(lang)}
              onClick={(e) => {
                e.preventDefault()
                platform.openUrl(guide(lang))
              }}
              className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
            >
              {m.guide}
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </a>
          </p>
        </div>
        {s.read?.kind !== "missing" && !demo && (
          <span className="flex flex-wrap items-center gap-2">
            {s.read?.kind === "ready" && <AddButton />}
            <Button
              variant="ghost"
              size="sm"
              disabled={s.reading}
              onClick={() => load()}
              icon={
                s.reading ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-4" aria-hidden />
                )
              }
            >
              {s.reading && s.read ? m.reading : m.readAgain}
            </Button>
          </span>
        )}
      </div>

      {demo && <DemoNote />}
      <div inert={demo || undefined} className="contents">
        {s.error ? (
          <ErrorNotice action={<ReportThis what="Reading memory" error={s.error} />}>
            {m.readFailed} {s.error}
          </ErrorNotice>
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

            {s.read === null ? (
              <RackSkeleton />
            ) : s.entries.length === 0 ? (
              <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
                <p className="font-medium text-ink">{m.emptyTitle}</p>
                <p className="mt-1 max-w-[70ch]">{m.emptyBody}</p>
                <Button size="sm" className="mt-3" onClick={() => useNav.getState().go("agents")}>
                  {m.goAgents}
                </Button>
              </div>
            ) : (
              <Rack entries={shown} groups={groups} tab={s.tab} filtering={filtering} />
            )}
            {ordered.length > PAGE_SIZES[0] && (
              <Pager
                page={at}
                onPage={s.setPage}
                total={ordered.length}
                size={s.pageSize}
                sizes={PAGE_SIZES}
                onSize={s.setPageSize}
              />
            )}

            {ready?.linksError && (
              <ErrorNotice action={<ReportThis what="Reading memory links" error={ready.linksError} />}>
                {m.linksFailed} {ready.linksError}
              </ErrorNotice>
            )}
            {ready?.more && <p className="text-[0.9rem] text-ink-dim">{m.more}</p>}
            {ready && <Activity calls={ready.activity} error={ready.activityError} />}
          </>
        )}
      </div>

      <ForgetDialog entry={forgetting} />
    </div>
  )
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
  entries,
  groups,
  tab,
  filtering,
}: {
  entries: MemoryEntry[]
  groups: Group[]
  tab: Tab
  filtering: boolean
}) {
  const m = useMessages(memoryMessages)
  const leaving = useMemory((s) => s.leaving)
  const arriving = useMemory((s) => s.arriving)
  const { setTab, setQuery } = useMemory.getState()

  if (entries.length === 0)
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.2rem] text-[0.95rem] text-ink-soft">
        <p>{filtering ? m.noMatch : m.nothing[tab]}</p>
        {filtering ? (
          <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setQuery("")}>
            {m.clearFilters}
          </Button>
        ) : (
          tab === "review" && (
            <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setTab("inuse")}>
              {m.showInUse}
            </Button>
          )
        )}
      </div>
    )

  return <SubjectRack entries={entries} groups={groups} leaving={leaving} arriving={arriving} />
}

type Group = { key: string; entries: MemoryEntry[]; waiting: number }

/** Version 2: one run per subject, those with something waiting first, then the most recently touched. */
function bySubjectGroups(entries: MemoryEntry[]): Group[] {
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
      (b.entries[0]?.createdAt ?? "").localeCompare(a.entries[0]?.createdAt ?? ""),
  )
}

/** Approves every single row on screen; the count says how many, and the rows turn green where they are. */
function ApproveShown({ refs }: { refs: string[] }) {
  const m = useMessages(memoryMessages)
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
    <Button
      size="sm"
      onClick={approve}
      title={m.approveShownHint(refs.length)}
      icon={
        running ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )
      }
    >
      {m.approveShown(refs.length)}
    </Button>
  )
}

/** One page of rows under their subjects; a subject's count is of all its rows, not only this page's. */
function SubjectRack({
  entries,
  groups,
  leaving,
  arriving,
}: {
  entries: MemoryEntry[]
  groups: Group[]
  leaving: string[]
  arriving: string[]
}) {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const closed = useMemory((s) => s.closedGroups)
  const toggleGroup = useMemory((s) => s.toggleGroup)
  const onPage = new Set(entries.map((e) => e.ref))
  return (
    <section aria-label={m.rows} className="rounded-[0.2rem] border border-line-strong bg-app">
      {groups.flatMap((whole) => {
        const g = { ...whole, entries: whole.entries.filter((e) => onPage.has(e.ref)) }
        if (g.entries.length === 0) return []
        const subject = g.entries[0] ? subjectOf(g.entries[0]) : null
        const open = !closed.includes(g.key)
        return (
          <section key={g.key || "none"} className="border-line [&+&]:border-t">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-[1.3rem]">
              <h2 className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleGroup(g.key)}
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
  const name = useId()
  return (
    <fieldset className="inline-flex h-[2.8rem] items-stretch self-start rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{m.show}</legend>
      {TABS.map((t) => (
        <label key={t} className="relative flex">
          <input type="radio" name={name} checked={t === value} onChange={() => onChange(t)} className="peer sr-only" />
          <span className="flex h-[calc(2.8rem-6px)] cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] px-[0.8rem] text-[0.95rem] text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {m.tabs[t]}
            <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{count(t)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function RackSkeleton() {
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-[4.5rem] items-center gap-[0.9rem] border-line px-[1.3rem] not-first:border-t">
          <Skeleton className="size-[1.4rem] rounded-full" />
          <Skeleton className="size-[1.6rem] rounded-[0.3rem]" />
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
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />
  return (
    <span className="flex shrink-0 items-center gap-2">
      {said}
      <Button
        size="sm"
        variant="ghost"
        disabled={!!running}
        title={x.rejectAllHint}
        onClick={() => void decide(false)}
        icon={running === "reject" ? spin : <X className="size-4" aria-hidden />}
      >
        {x.rejectAll(waiting.length)}
      </Button>
      <Button
        size="sm"
        disabled={!!running}
        title={x.approveAllHint}
        onClick={() => void decide(true)}
        icon={running === "approve" ? spin : <Check className="size-4" aria-hidden />}
      >
        {x.approveAll(waiting.length)}
      </Button>
    </span>
  )
}
