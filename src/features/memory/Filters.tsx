import { useRef, useState } from "react"
import { byOwner, inTab, type MemoryField, memoryFilter, projectNameOf, RANGES, setMemoryField } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Calendar, CalendarFooter, DatePopover } from "@/ui/Calendar"
import { FilterBar } from "@/ui/FilterBar"
import { FilterMenu, type FilterOption } from "@/ui/FilterMenu"
import { authorOf, dayLabel, kindOf } from "./labels"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

/** Every distinct value with how many records in the tab carry it, most common first. */
function tally(entries: readonly MemoryEntry[], pick: (e: MemoryEntry) => [string, string] | null): FilterOption[] {
  const seen = new Map<string, FilterOption & { count: number }>()
  for (const e of entries) {
    const p = pick(e)
    if (!p) continue
    const [value, label] = p
    const had = seen.get(value)
    if (had) had.count++
    else seen.set(value, { value, label, count: 1 })
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Memory's search with the Tasks look: one field, and chips that write `field:value` words into it. */
export function Filters() {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const query = useMemory((s) => s.query)
  const entries = useMemory((s) => s.entries)
  const tab = useMemory((s) => s.tab)
  const { setQuery } = useMemory.getState()
  const [picking, setPicking] = useState(false)
  const whenAnchor = useRef<HTMLSpanElement>(null)

  const f = memoryFilter(query)
  const inView = entries.filter((e) => inTab(tab, e.status))
  const field = (name: Exclude<MemoryField, "when">, options: FilterOption[]) => ({
    selected: f[name],
    // A value typed by hand that no record carries still shows, so its chip can clear it.
    options: [
      ...options,
      ...f[name].filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v })),
    ],
    onChange: (values: string[]) => setQuery(setMemoryField(query, name, values)),
  })

  const subjects = tally(inView, (e) =>
    e.subjectIsOwner ? ["me", m.you] : e.subject ? [e.subject, e.subjectName ?? e.subject] : null,
  )
  const projects = tally(inView, (e) => {
    const name = projectNameOf(e)
    return name ? [name, name] : null
  })
  const kinds = tally(inView, (e) => [e.kind, kindOf(e.kind, m)])
  const authors = tally(inView, (e) => (byOwner(e) ? ["me", m.you] : [authorOf(e, m), authorOf(e, m)]))

  const day = (RANGES as readonly string[]).includes(f.when) ? null : f.when
  const whenOptions: FilterOption[] = [
    ...RANGES.filter((r) => r !== "any").map((r) => ({ value: r, label: m.ranges[r] ?? r })),
    { value: "day", label: day ? dayLabel(`${day}T12:00:00`, m, lang) : m.otherDay },
  ]

  return (
    <FilterBar query={query} onQuery={setQuery} label={m.search} placeholder={m.searchHint}>
      <FilterMenu label={m.about} {...field("subject", subjects)} />
      <FilterMenu label={m.by} {...field("by", authors)} />
      <FilterMenu label={m.projectFilter} {...field("project", projects)} />
      <FilterMenu label={m.kindFilter} {...field("kind", kinds)} />
      <span ref={whenAnchor} className="inline-flex">
        <FilterMenu
          label={m.when}
          single
          options={whenOptions}
          selected={f.when === "any" ? [] : [day ? "day" : f.when]}
          onChange={([v]) => {
            if (v === "day") setPicking(true)
            else setQuery(setMemoryField(query, "when", v ? [v] : []))
          }}
        />
      </span>
      <DatePopover
        open={picking}
        anchor={whenAnchor}
        onClose={(refocus) => {
          setPicking(false)
          if (refocus) whenAnchor.current?.querySelector<HTMLElement>("button")?.focus()
        }}
        label={m.when}
      >
        <Calendar
          selected={day ? { from: day } : null}
          autoFocus
          label={m.when}
          onPick={(d) => {
            setQuery(setMemoryField(query, "when", [d]))
            setPicking(false)
            whenAnchor.current?.querySelector<HTMLElement>("button")?.focus()
          }}
        />
        <CalendarFooter
          onToday={() => {
            setQuery(setMemoryField(query, "when", ["today"]))
            setPicking(false)
          }}
        >
          <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
            {m.cancel}
          </Button>
        </CalendarFooter>
      </DatePopover>
    </FilterBar>
  )
}
