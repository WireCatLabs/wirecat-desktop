import { LoaderCircle } from "lucide-react"
import { formatUsd } from "@/domain/mail-agent"
import { ago } from "@/features/tools"
import { useLang, useMessages } from "@/i18n"
import type { DigestItem } from "@/platform/bindings"
import { type Column, DataTable } from "@/ui/DataTable"
import { Lamp } from "@/ui/Lamp"
import { Switch } from "@/ui/Switch"
import { type BookText, bookMessages, type Source } from "./messages-book"
import { scheduleMessages } from "./messages-schedule"
import { MORNING, useDigestBook } from "./schedule-store"

export const titleOf = (d: DigestItem, m: BookText) => d.title ?? (d.name === MORNING ? m.morning : d.name)

/** "Tue 08:30", in the owner's language and clock. */
export const nextOf = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

/** The digests memo keeps, one row each; a row opens the digest, its switch puts it on or off the schedule. */
export function DigestTable({ digests, harness }: { digests: DigestItem[]; harness: boolean }) {
  const m = useMessages(bookMessages)
  const s = useMessages(scheduleMessages)
  const lang = useLang()
  const { busy, openDigest, setScheduled } = useDigestBook()

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
          {d.scheduled && d.nextAt && (
            <span className="text-[0.85rem] text-ink-dim tabular-nums">{m.nextAt(nextOf(d.nextAt, lang))}</span>
          )}
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
    <DataTable
      label={m.table}
      rows={digests}
      rowKey={(d) => d.name}
      columns={columns}
      density="roomy"
      minWidth="60rem"
      leadWidth="minmax(10rem,1.4fr)"
      onRowClick={(d) => openDigest(d.name)}
    />
  )
}
