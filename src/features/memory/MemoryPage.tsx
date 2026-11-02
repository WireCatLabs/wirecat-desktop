import { ChevronDown, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { inTab, matchesFilter, memoryFilter, subjectOf, type Tab } from "@/domain/memory"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { openTool } from "../tools/go"
import { useTools } from "../tools/store"
import { Activity } from "./Activity"
import { Filters } from "./Filters"
import { ForgetDialog } from "./ForgetDialog"
import { memoryMessages } from "./messages"
import { Row, SubjectLabel } from "./Row"
import { useMemory } from "./store"

const GUIDE = "https://github.com/WireCatLabs/cli-memo/blob/main/docs/memories.md"
const TABS: Tab[] = ["review", "inuse", "discarded", "all"]

export function MemoryPage() {
  const m = useMessages(memoryMessages)
  const s = useMemory()
  const { load } = s

  useEffect(() => {
    load()
  }, [load])

  const ready = s.read?.kind === "ready" ? s.read : null
  const filter = memoryFilter(s.query)
  const filtered = s.entries.filter((e) => matchesFilter(e, filter))
  const shown = filtered.filter((e) => inTab(s.tab, e.status) || s.held.includes(e.ref))
  const count = (tab: Tab) => filtered.filter((e) => inTab(tab, e.status)).length
  const forgetting = s.entries.find((e) => e.ref === s.forgetting) ?? null
  const filtering = s.query.trim() !== ""

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            {m.intro}{" "}
            <a
              href={GUIDE}
              onClick={(e) => {
                e.preventDefault()
                platform.openUrl(GUIDE)
              }}
              className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
            >
              {m.guide}
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </a>
          </p>
        </div>
        {s.read?.kind !== "missing" && (
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
        )}
      </div>

      {s.error ? (
        <ErrorNotice action={<ReportThis what="Reading memory" error={s.error} />}>
          {m.readFailed} {s.error}
        </ErrorNotice>
      ) : s.read?.kind === "missing" ? (
        <Notice>
          <p>{m.missing}</p>
          <Button size="sm" onClick={() => openTool("memo")}>
            {m.goTools}
          </Button>
        </Notice>
      ) : s.read?.kind === "old" ? (
        <OldNotice version={s.read.version} need={s.read.need} />
      ) : (
        <>
          <div className="flex flex-col gap-[1rem]">
            <Tabs value={s.tab} onChange={s.setTab} count={count} />
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
            <Rack entries={shown} tab={s.tab} filtering={filtering} />
          )}

          {ready?.more && <p className="text-[0.9rem] text-ink-dim">{m.more}</p>}
          {ready && <Activity calls={ready.activity} error={ready.activityError} />}
        </>
      )}

      <ForgetDialog entry={forgetting} />
    </div>
  )
}

function Rack({ entries, tab, filtering }: { entries: MemoryEntry[]; tab: Tab; filtering: boolean }) {
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

  return <SubjectRack entries={entries} leaving={leaving} arriving={arriving} />
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

function SubjectRack({
  entries,
  leaving,
  arriving,
}: {
  entries: MemoryEntry[]
  leaving: string[]
  arriving: string[]
}) {
  const m = useMessages(memoryMessages)
  const [closed, setClosed] = useState<string[]>([])
  return (
    <section aria-label={m.rows} className="rounded-[0.2rem] border border-line-strong bg-app">
      {bySubjectGroups(entries).map((g) => {
        const subject = g.entries[0] ? subjectOf(g.entries[0]) : null
        const open = !closed.includes(g.key)
        return (
          <section key={g.key || "none"} className="border-line [&+&]:border-t">
            <h2>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setClosed((c) => (open ? [...c, g.key] : c.filter((k) => k !== g.key)))}
                className="group flex w-full cursor-pointer items-center gap-[0.7rem] px-[1.3rem] pt-[1rem] pb-[0.6rem] text-left"
              >
                {subject ? (
                  <SubjectLabel subject={subject} className="text-[1.05rem] font-semibold" />
                ) : (
                  <span className="text-[1.05rem] font-semibold text-ink-soft">{m.noSubject}</span>
                )}
                {g.waiting > 0 && <Lamp tone="warn" size="sm" />}
                <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">
                  {m.groupCount(g.waiting, g.entries.length)}
                </span>
                <ChevronDown
                  className={cx(
                    "ml-auto size-4 text-ink-dim transition-transform duration-150 group-hover:text-ink",
                    !open && "-rotate-90",
                  )}
                  aria-hidden
                />
              </button>
            </h2>
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
          <span className="flex cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] px-[0.8rem] text-[0.95rem] text-ink-soft transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {t === "review" && count("review") > 0 && <Lamp tone="warn" size="sm" />}
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

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem] text-[0.95rem] text-ink-soft">
      {children}
    </div>
  )
}

function OldNotice({ version, need }: { version: string | null; need: string }) {
  const m = useMessages(memoryMessages)
  const install = useTools((s) => s.install)
  return (
    <Notice>
      <p className="max-w-[70ch]">{m.old(version, need)}</p>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          install("memo")
          openTool("memo")
        }}
      >
        {m.update}
      </Button>
    </Notice>
  )
}
