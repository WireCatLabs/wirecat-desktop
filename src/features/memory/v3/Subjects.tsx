import { ArrowLeft, ChevronRight, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { byOwner, tabOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Collapse } from "@/ui/Collapse"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace } from "@/ui/motion"
import { authorOf, dayLabel, kindOf, savedAt, timeOf } from "../labels"
import { memoryMessages } from "../messages"
import { ItemRow, SubjectIcon } from "./ItemRow"
import { v3Messages } from "./messages"
import { type SubjectGroup, subjectsOf } from "./model"

const rack = "rounded-[0.2rem] border border-line-strong bg-app"

export function Subjects({ entries }: { entries: MemoryEntry[] }) {
  const t = useMessages(v3Messages)
  const [open, setOpen] = useState<string | null>(null)
  const from = useRef<string | null>(null)
  const groups = subjectsOf(entries, t.you, t.notAbout)
  const current = groups.find((g) => g.key === open) ?? null

  useEffect(() => {
    if (open === null && from.current)
      focusInPlace(document.querySelector<HTMLElement>(`[data-subject="${CSS.escape(from.current)}"]`))
  }, [open])

  return (
    <AutoHeight swap={open}>
      {current ? (
        <div key={current.key} className="step-in">
          <SubjectPage group={current} onBack={() => setOpen(null)} />
        </div>
      ) : (
        <ul aria-label={t.views.subjects} className={`step-in ${rack}`}>
          {groups.map((g) => (
            <DirectoryRow
              key={g.key}
              group={g}
              onOpen={() => {
                from.current = g.key
                setOpen(g.key)
              }}
            />
          ))}
        </ul>
      )}
    </AutoHeight>
  )
}

function DirectoryRow({ group, onOpen }: { group: SubjectGroup; onOpen: () => void }) {
  const t = useMessages(v3Messages)
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const tone = group.waiting > 0 ? "warn" : group.kept > 0 ? "ok" : "idle"
  return (
    <li className="border-line not-first:border-t">
      <button
        type="button"
        data-subject={group.key}
        onClick={onOpen}
        className="group grid min-h-[3.6rem] w-full cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-[0.9rem] px-[1.3rem] text-left hover:bg-app-2/60"
      >
        <Lamp tone={tone} size="sm" />
        <span className="text-ink-soft">
          <SubjectIcon subject={group.subject} />
        </span>
        <span className="min-w-0 truncate text-[1rem] font-medium group-hover:text-brand">
          {group.name}
          <span className="ml-[0.5rem] text-[0.9rem] font-normal text-ink-dim">
            {t.kindLabel[group.subject?.kind ?? "other"]}
          </span>
        </span>
        <span className="font-mono text-[0.85rem] tabular-nums text-ink-soft">
          {t.counts(group.waiting, group.kept)}
        </span>
        <span className="w-[7rem] text-right font-mono text-[0.85rem] tabular-nums text-ink-dim">
          {dayLabel(group.last, m, lang)}
        </span>
        <ChevronRight className="size-4 text-ink-dim" aria-hidden />
      </button>
    </li>
  )
}

function SubjectPage({ group, onBack }: { group: SubjectGroup; onBack: () => void }) {
  const t = useMessages(v3Messages)
  const m = useMessages(memoryMessages)
  const waiting = group.entries.filter((e) => tabOf(e.status) === "review")
  const known = group.entries.filter((e) => tabOf(e.status) === "inuse" && !e.findings)
  const byKind = new Map<string, MemoryEntry[]>()
  for (const e of known) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e])
  const tasks = group.entries.flatMap((e) =>
    (e.findings ?? []).filter((f) => f.kind === "task" && f.outcome === "accepted").map((f) => ({ ...f, at: e })),
  )
  const writers = new Map<string, number>()
  for (const e of group.entries) {
    const who = authorOf(e, m)
    writers.set(who, (writers.get(who) ?? 0) + 1)
  }
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    back.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="flex flex-col gap-[1.4rem]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button
            ref={back}
            type="button"
            onClick={onBack}
            className="inline-flex cursor-pointer items-center gap-[0.35rem] text-[0.9rem] font-medium text-brand hover:text-brand-hover"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t.back}
          </button>
          <h2 className="mt-[0.6rem] flex items-center gap-[0.5rem] text-[1.2rem] font-semibold leading-tight">
            <SubjectIcon subject={group.subject} />
            {group.name}
          </h2>
          <p className="mt-[0.2rem] text-[0.9rem] text-ink-dim">{t.kindLabel[group.subject?.kind ?? "other"]}</p>
        </div>
        {group.subject?.kind !== "you" && group.key !== "none" && (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-[0.35rem] text-[0.9rem] font-medium text-brand hover:text-brand-hover"
          >
            <Search className="size-4" aria-hidden />
            {t.search(group.name)}
          </button>
        )}
      </div>

      {waiting.length > 0 && (
        <Section title={t.waiting} count={waiting.length}>
          <div className={rack}>
            {waiting.map((e) => (
              <ItemRow key={e.ref} entry={e} showSubject={false} />
            ))}
          </div>
        </Section>
      )}

      <Section title={t.knows} count={known.length}>
        {known.length === 0 ? (
          <p className="text-[0.95rem] text-ink-soft">{t.nothingKnown}</p>
        ) : (
          <div className={rack}>
            {[...byKind].map(([kind, list]) => (
              <section
                key={kind}
                aria-label={t.groups[kind] ?? kindOf(kind, m)}
                className="border-line not-first:border-t"
              >
                <h4 className="px-[1.3rem] pt-[0.8rem] text-[0.9rem] font-medium text-ink-dim">
                  {t.groups[kind] ?? kindOf(kind, m)}
                </h4>
                <ul>
                  {list.map((e) => (
                    <Known key={e.ref} entry={e} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Section>

      {group.subject?.kind === "project" && (
        <Section title={t.tasks} count={tasks.length}>
          {tasks.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft">{t.noTasks}</p>
          ) : (
            <ul className={rack}>
              {tasks.map((task) => (
                <li
                  key={`${task.at.ref}:${task.id}`}
                  className="flex items-center gap-[0.8rem] border-line px-[1.3rem] py-[0.7rem] not-first:border-t"
                >
                  <Lamp tone="ok" size="sm" />
                  <span className="selectable text-[0.95rem]">{task.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title={t.writers} count={writers.size}>
        <p className="flex flex-wrap gap-x-[1.2rem] gap-y-[0.3rem] text-[0.95rem]">
          {[...writers].map(([who, n]) => (
            <span key={who}>
              <span className="font-mono text-[0.9rem]">{who}</span>{" "}
              <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{n}</span>
            </span>
          ))}
        </p>
      </Section>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[0.6rem]">
      <h3 className="flex items-baseline gap-[0.5rem] text-[1.05rem] font-semibold">
        {title}
        <span className="font-mono text-[0.85rem] font-normal tabular-nums text-ink-dim">{count}</span>
      </h3>
      {children}
    </section>
  )
}

function Known({ entry }: { entry: MemoryEntry }) {
  const t = useMessages(v3Messages)
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  return (
    <li className="px-[1.3rem] py-[0.6rem]">
      <p className="selectable max-w-[75ch] text-[0.98rem] leading-relaxed">{entry.text}</p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-[0.15rem] inline-flex cursor-pointer items-center gap-[0.2rem] text-[0.85rem] text-ink-dim hover:text-ink"
      >
        <ChevronRight
          className={`size-[0.85rem] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        {t.details} · <span className="font-mono tabular-nums">{timeOf(entry.createdAt, lang)}</span>
      </button>
      <Collapse open={open}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[0.2rem] pt-[0.4rem] text-[0.9rem]">
          <dt className="text-ink-dim">{t.writtenBy}</dt>
          <dd className={byOwner(entry) ? "" : "font-mono text-[0.85rem]"}>{authorOf(entry, m)}</dd>
          <dt className="text-ink-dim">{t.saved}</dt>
          <dd className="font-mono text-[0.85rem] tabular-nums">{savedAt(entry.createdAt, lang)}</dd>
        </dl>
      </Collapse>
    </li>
  )
}
