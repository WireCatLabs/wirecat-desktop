import { LoaderCircle, TriangleAlert } from "lucide-react"
import { formatUsd } from "@/domain/mail-agent"
import { freeWords, setField, valuesOf } from "@/domain/query-terms"
import { useLang, useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import type { DigestItem } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { type Column, DataTable } from "@/ui/DataTable"
import { EmptyState } from "@/ui/EmptyState"
import { FilterBar } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { Lamp } from "@/ui/Lamp"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { Switch } from "@/ui/Switch"
import { type BookText, bookMessages, type Source } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { MORNING, useDigestBook } from "./schedule-store"

export const titleOf = (d: DigestItem, m: BookText) => d.title ?? (d.name === MORNING ? m.morning : d.name)

/** "Tue 08:30", in the owner's language and clock. */
export const nextOf = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

const FIELDS = "schedule|last|source"
const scheduleOf = (d: DigestItem) => (d.scheduled ? "on" : "off")
const lastOf = (d: DigestItem) => (d.last ? (d.last.ok ? "ok" : "failed") : "never")
// A digest with no sources reads every connected one, so it matches whichever source is asked for.
const reads = (d: DigestItem, source: string) => d.sources.length === 0 || d.sources.includes(source)

/** Whether a digest passes the filter chips and every typed word, which is looked for in its title and name. */
export function digestMatches(d: DigestItem, query: string, title: string) {
  const wants = (field: string, value: string) => {
    const values = valuesOf(query, field)
    return values.length === 0 || values.includes(value)
  }
  const sources = valuesOf(query, "source")
  const text = `${title} ${d.name}`.toLocaleLowerCase()
  return (
    wants("schedule", scheduleOf(d)) &&
    wants("last", lastOf(d)) &&
    (sources.length === 0 || sources.some((x) => reads(d, x))) &&
    freeWords(query, FIELDS).every((w) => text.includes(w.toLocaleLowerCase()))
  )
}

/** The digests memo keeps, one row each; a row opens the digest, its switch puts it on or off the schedule. */
export function DigestTable({ digests, harness }: { digests: DigestItem[]; harness: boolean }) {
  const m = useMessages(bookMessages)
  const s = useMessages(scheduleMessages)
  const lang = useLang()
  const { busy, openDigest, setScheduled, query, page, pageSize, setQuery, setPage, setPageSize } = useDigestBook()
  const rows = digests.filter((d) => digestMatches(d, query, titleOf(d, m)))
  const at = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))
  const field = (
    f: string,
    options: { value: string; label: string }[],
    has: (d: DigestItem, v: string) => boolean,
  ) => ({
    selected: valuesOf(query, f),
    onChange: (chosen: string[]) => setQuery(setField(query, f, chosen)),
    options: options.map((o) => ({ ...o, count: digests.filter((d) => has(d, o.value)).length })),
  })
  const sources = [...new Set([...digests.flatMap((d) => d.sources), ...valuesOf(query, "source")])]

  const columns: Column<DigestItem>[] = [
    {
      id: "name",
      head: m.col.name,
      width: "minmax(0,1fr)",
      lead: true,
      sortBy: (d) => titleOf(d, m).toLowerCase(),
      cell: (d) => (
        <button
          type="button"
          aria-label={m.open(titleOf(d, m))}
          onClick={(e) => {
            e.stopPropagation()
            openDigest(d.name)
          }}
          className="flex min-w-0 cursor-pointer flex-col text-left"
        >
          <span className="font-medium text-ink [overflow-wrap:anywhere] group-hover:text-brand">{titleOf(d, m)}</span>
          <span className="font-mono text-[0.8rem] text-ink-dim [overflow-wrap:anywhere]">{d.name}</span>
          {d.needs && (
            <span className="mt-0.5 flex items-center gap-1 text-[0.85rem] text-warn-ink" title={d.needs}>
              <TriangleAlert className="size-3.5 shrink-0 text-warn" aria-hidden />
              {m.one.needs}
            </span>
          )}
        </button>
      ),
    },
    {
      id: "when",
      head: m.col.when,
      width: "minmax(9.5rem,1.2fr)",
      cell: (d) => (
        <span className="flex flex-col text-ink-soft">
          <span>{m.when(d.times, d.weekdays)}</span>
          {/* Always takes its line: the switch must not change the row's height. */}
          <span
            aria-hidden={!(d.scheduled && d.nextAt)}
            className={cx(
              "text-[0.85rem] text-ink-dim tabular-nums transition-opacity duration-(--motion-normal)",
              d.scheduled && d.nextAt ? "opacity-100" : "opacity-0",
            )}
          >
            {d.nextAt ? m.nextAt(nextOf(d.nextAt, lang)) : " "}
          </span>
        </span>
      ),
    },
    {
      id: "sources",
      head: m.col.sources,
      width: "minmax(7rem,1fr)",
      cell: (d) => (
        <span className="line-clamp-2 text-ink-soft">
          {d.sources.length === 0 ? m.allSources : d.sources.map((x) => m.sources[x as Source] ?? x).join(", ")}
        </span>
      ),
    },
    {
      id: "routes",
      head: m.col.routes,
      width: "minmax(7rem,1fr)",
      cell: (d) => (
        <span className="line-clamp-2 text-ink-soft">
          {d.routes.length === 0 ? m.onlyHere : [...new Set(d.routes.map((r) => s.routeKinds[r.kind]))].join(", ")}
        </span>
      ),
    },
    {
      id: "last",
      head: m.col.last,
      width: "minmax(10rem,1fr)",
      sortBy: (d) => d.last?.at ?? "",
      cell: (d) =>
        busy[d.name] === "run" ? (
          <span className="flex items-center gap-2 text-ink-soft">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {m.running}
          </span>
        ) : d.last ? (
          <span className="flex items-baseline gap-2 text-ink-soft">
            <Lamp tone={d.last.ok ? "ok" : "bad"} size="sm" />
            <span className="flex flex-col tabular-nums">
              <span>
                {ago(d.last.at)}
                {!d.last.ok && ` · ${m.lastFailed}`}
              </span>
              {d.last.costUsd !== null && (
                <span className="text-[0.85rem] text-ink-dim">{formatUsd(d.last.costUsd, lang)}</span>
              )}
            </span>
          </span>
        ) : (
          <span className="text-ink-dim">{m.never}</span>
        ),
    },
    {
      id: "scheduled",
      head: m.col.scheduled,
      width: "7.5rem",
      cell: (d) => (
        // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: keeps the switch's click off the row
        <span onClick={(e) => e.stopPropagation()} className="flex">
          <Switch
            aria-label={m.scheduleSwitch(titleOf(d, m))}
            checked={busy[d.name] === "schedule" ? !d.scheduled : d.scheduled}
            disabled={busy[d.name] !== undefined || (!d.scheduled && !harness)}
            onChange={(on) => void setScheduled(d, on)}
          />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-[0.7rem]">
      <FilterBar query={query} onQuery={setQuery} label={m.list.search} placeholder={m.list.placeholder} inline>
        <FilterMenu
          label={m.list.schedule}
          single
          {...field(
            "schedule",
            [
              { value: "on", label: m.list.on },
              { value: "off", label: m.notScheduled },
            ],
            (d, v) => scheduleOf(d) === v,
          )}
        />
        <FilterMenu
          label={m.list.last}
          {...field(
            "last",
            [
              { value: "ok", label: m.list.ok },
              { value: "failed", label: m.list.failed },
              { value: "never", label: m.never },
            ],
            (d, v) => lastOf(d) === v,
          )}
        />
        {sources.length > 0 && (
          <FilterMenu
            label={m.col.sources}
            {...field(
              "source",
              sources.map((x) => ({ value: x, label: m.sources[x as Source] ?? x })),
              reads,
            )}
          />
        )}
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState
          action={
            <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
              {m.list.clear}
            </Button>
          }
        >
          {m.list.noMatch}
        </EmptyState>
      ) : (
        <DataTable
          label={m.table}
          rows={rows}
          rowKey={(d) => d.name}
          columns={columns}
          density="roomy"
          minWidth="60rem"
          leadWidth="minmax(10rem,1.4fr)"
          onRowClick={(d) => openDigest(d.name)}
          page={{ index: at, size: pageSize }}
        />
      )}
      {rows.length > PAGE_SIZES[0] && (
        <Pager
          label={m.table}
          page={at}
          onPage={setPage}
          total={rows.length}
          size={pageSize}
          sizes={PAGE_SIZES}
          onSize={setPageSize}
        />
      )}
    </div>
  )
}
