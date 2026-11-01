// Version 3: the subject (a person, a project, you) is the backbone. Memories, facts, tasks and whatever Memo adds
// next hang off a subject page; the inbox is the cross-subject queue of what waits, the timeline is what happened.
// New kinds of data become sections and facets here, not more tabs on one feed.
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { can, subjectOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace } from "@/ui/motion"
import { Skeleton } from "@/ui/Skeleton"
import { ForgetDialog } from "../ForgetDialog"
import { timeOf } from "../labels"
import { memoryMessages } from "../messages"
import { useMemory } from "../store"
import { ItemRow } from "./ItemRow"
import { type View, v3Messages } from "./messages"
import { runCounts, runsOf } from "./model"
import { Subjects } from "./Subjects"
import { Timeline } from "./Timeline"

const VIEWS: View[] = ["inbox", "subjects", "timeline"]

export function MemoryV3() {
  const m = useMessages(memoryMessages)
  const t = useMessages(v3Messages)
  const s = useMemory()
  const { load } = s
  const [view, setView] = useState<View>("inbox")

  useEffect(() => {
    load()
  }, [load])

  const waiting = s.entries.filter((e) => e.status === "proposed").length
  const forgetting = s.entries.find((e) => e.ref === s.forgetting) ?? null
  const calls = s.read?.kind === "ready" ? (s.read.activity ?? []) : []

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div>
        <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
        <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">{t.intro}</p>
      </div>
      {s.error ? (
        <ErrorNotice>
          {m.readFailed} {s.error}
        </ErrorNotice>
      ) : (
        <>
          <Views value={view} onChange={setView} waiting={waiting} />
          {s.read === null ? (
            <div className="flex flex-col gap-3 rounded-[0.2rem] border border-line-strong bg-app p-[1.3rem]">
              <Skeleton className="h-[1rem] w-[50%]" />
              <Skeleton className="h-[1rem] w-[70%]" />
              <Skeleton className="h-[1rem] w-[40%]" />
            </div>
          ) : (
            <AutoHeight swap={view}>
              <div key={view} className="step-in">
                {view === "inbox" ? (
                  <Inbox entries={s.entries} held={s.held} />
                ) : view === "subjects" ? (
                  <Subjects entries={s.entries} />
                ) : (
                  <Timeline entries={s.entries} calls={calls} />
                )}
              </div>
            </AutoHeight>
          )}
        </>
      )}
      <ForgetDialog entry={forgetting} />
    </div>
  )
}

function Views({ value, onChange, waiting }: { value: View; onChange: (v: View) => void; waiting: number }) {
  const t = useMessages(v3Messages)
  const name = useId()
  return (
    <fieldset className="inline-flex h-[2.8rem] items-center self-start rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{t.show}</legend>
      {VIEWS.map((v) => (
        <label key={v} className="relative h-full">
          <input type="radio" name={name} checked={v === value} onChange={() => onChange(v)} className="peer sr-only" />
          <span className="flex h-full cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] px-[0.8rem] text-[0.95rem] text-ink-soft transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {v === "inbox" && waiting > 0 && <Lamp tone="warn" size="sm" />}
            {t.views[v]}
            {v === "inbox" && <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{waiting}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** Rows decided here stay until the view changes or the page reads again (rule 9), like `held` on version 1. */
function Inbox({ entries, held }: { entries: MemoryEntry[]; held: string[] }) {
  const t = useMessages(v3Messages)
  const lang = useLang()
  const shown = entries.filter((e) => e.status === "proposed" || held.includes(e.ref))
  const runs = runsOf(shown.map((e) => (held.includes(e.ref) ? { ...e, status: "proposed" } : e))).map((r) => ({
    ...r,
    entries: r.entries.map((e) => entries.find((x) => x.ref === e.ref) ?? e),
  }))
  const order = runs.flatMap((r) => r.entries.map((e) => e.ref))
  const [active, setActive] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const move = (step: number) => {
    const i = active ? order.indexOf(active) : -1
    const next = order[Math.max(0, Math.min(order.length - 1, i + step))]
    if (!next) return
    setActive(next)
    focusInPlace(box.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(next)}"]`) ?? null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const entry = entries.find((x) => x.ref === active)
    const { confirm, discard, startCorrect } = useMemory.getState()
    if (e.key === "j" || e.key === "ArrowDown") move(1)
    else if (e.key === "k" || e.key === "ArrowUp") move(-1)
    else if (entry && e.key === "a" && can(entry).confirm) confirm(entry.ref)
    else if (entry && e.key === "d" && can(entry).discard) discard(entry.ref)
    else if (entry && e.key === "e" && can(entry).correct) startCorrect(entry.ref)
    else return
    e.preventDefault()
  }

  if (runs.length === 0)
    return (
      <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem] text-[0.95rem] text-ink-soft">
        {t.inboxEmpty}
      </p>
    )

  return (
    <div className="flex flex-col gap-[0.6rem]">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the keys only add shortcuts; every action is a button too */}
      <div ref={box} onKeyDown={onKeyDown} className="rounded-[0.2rem] border border-line-strong bg-app">
        {runs.map((run) => {
          const projects = [
            ...new Set(run.entries.map((e) => subjectOf(e)).map((s) => (s?.kind === "project" ? s.name : null))),
          ].filter((n): n is string => !!n)
          return (
            <section key={run.key} aria-label={run.agent} className="border-line [&+&]:border-t">
              <h2 className="flex flex-wrap items-baseline gap-x-[0.4rem] border-line border-b px-[1.3rem] py-[0.6rem] text-[0.9rem] text-ink-soft">
                <span className="font-mono text-[0.85rem] text-ink">{run.agent === "you" ? t.you : run.agent}</span>
                {t.run(t.what(runCounts(run).map(([w, n]) => [t.words[w] ?? w, n])))}
                {projects.length > 0 && (
                  <>
                    {" "}
                    {t.forSubject} <span className="font-medium text-ink">{projects.join(", ")}</span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{timeOf(run.at, lang)}</span>
              </h2>
              {run.entries.map((e) => (
                <ItemRow key={e.ref} entry={e} active={active === e.ref} onActivate={() => setActive(e.ref)} />
              ))}
            </section>
          )
        })}
      </div>
      <p className="font-mono text-[0.85rem] text-ink-dim">{t.hint}</p>
    </div>
  )
}
