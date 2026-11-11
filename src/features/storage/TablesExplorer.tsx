import { ArrowDown, ArrowUp, Search } from "lucide-react"
import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { sortTables, splitTables, type TableSort, totalBytes } from "@/domain/database"
import { formatBytes } from "@/domain/format"
import { groupOf, TABLE_GROUPS, type TableGroup } from "@/domain/table-groups"
import { formatNumber, useMessages } from "@/i18n"
import type { Table } from "@/platform/archive-schemas"
import { ReportThis } from "@/shared/ReportThis"
import { useStorage } from "@/shared/storage-store"
import { useElapsed } from "@/shared/use-elapsed"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Disclosure, DisclosureSkeleton } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { SectionTitle } from "@/ui/SectionTitle"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { storageMessages } from "./messages"

const COLUMNS: { key: TableSort["key"]; numeric: boolean }[] = [
  { key: "name", numeric: false },
  { key: "kind", numeric: false },
  { key: "rows", numeric: true },
  { key: "bytes", numeric: true },
]

export function TablesExplorer({ answeredBy }: { answeredBy: string }) {
  const m = useMessages(storageMessages)
  const tables = useStorage((s) => s.tables)
  const tablesError = useStorage((s) => s.tablesError)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<TableSort>({ key: "name", descending: false })
  const [group, setGroup] = useState<TableGroup | null>(null)
  const tool = findTool(answeredBy)?.name ?? answeredBy

  if (tables === undefined) return <TablesSkeleton />
  if (tables && !tables.available)
    return (
      <Frame count={null}>
        <p className="text-[0.9rem] text-ink-soft">{m.listLater(tool)}</p>
      </Frame>
    )

  const { main, search } = splitTables(tables?.tables ?? [])
  const groupLabel = (t: Table) => m.tableGroup[groupOf(t)]
  const kindLabel = (t: Table) => m.tableKind[t.kind] ?? t.kind
  const inGroup = group === null ? main : main.filter((t) => groupOf(t) === group)
  const shownMain = sortTables(inGroup, query, sort, groupLabel)
  // Full-text indexes count as search: they stay under their heading for All and Search, and fold away for the rest.
  const searchShown = group === null || group === "search"
  const shownSearch = sortTables(search, query, sort, kindLabel)
  const onSort = (key: TableSort["key"]) =>
    setSort((s) =>
      s.key === key ? { key, descending: !s.descending } : { key, descending: key !== "name" && key !== "kind" },
    )

  return (
    <Frame count={tables ? main.length + search.length : null} className="reveal">
      {tablesError && (
        <ErrorNotice
          raw={tablesError}
          inline
          action={<ReportThis what="Listing the storage tables" error={tablesError} />}
        >
          {m.listError}
        </ErrorNotice>
      )}
      {tables === null ? null : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-w-[14rem] flex-1 items-center sm:max-w-[22rem]">
              <Search className="pointer-events-none absolute left-[0.6rem] size-[0.95rem] text-ink-dim" aria-hidden />
              <input
                type="search"
                aria-label={m.findTable}
                placeholder={m.findTable}
                spellCheck={false}
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="selectable h-8 w-full rounded-[0.35rem] border border-line-strong bg-app pr-2 pl-[2rem] font-mono text-[0.875rem] text-ink placeholder:font-sans placeholder:text-ink-dim"
              />
            </label>
            <MeasureSizes measured={tables.measured} />
          </div>
          <GroupFilter tables={[...main, ...search]} value={group} onChange={setGroup} measured={tables.measured} />
          <AutoHeight swap={group}>
            <TableOf
              tables={shownMain}
              typeOf={groupLabel}
              sort={sort}
              onSort={onSort}
              label={m.tables}
              measured={tables.measured}
            />
          </AutoHeight>
          {query.trim() !== "" && shownMain.length === 0 && (!searchShown || shownSearch.length === 0) && (
            <p className="text-[0.9rem] text-ink-soft">{m.noMatch(query.trim())}</p>
          )}
          <Collapse open={searchShown && shownSearch.length > 0}>
            <Disclosure
              summary={
                <>
                  {m.searchTables(shownSearch.length)}
                  {tables.measured && (
                    <span className="font-mono text-ink-dim tabular-nums">
                      {" "}
                      · {formatBytes(totalBytes(shownSearch))}
                    </span>
                  )}
                </>
              }
            >
              <p className="mb-2 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.searchNote}</p>
              <TableOf
                tables={shownSearch}
                typeOf={kindLabel}
                sort={sort}
                onSort={onSort}
                label={m.searchTablesLabel}
                measured={tables.measured}
              />
            </Disclosure>
          </Collapse>
        </>
      )}
    </Frame>
  )
}

/** A full table list, sized as it arrives: the list box is at its maximum height whenever there are many tables. */
export function TablesSkeleton() {
  const m = useMessages(storageMessages)
  return (
    <Frame count={null}>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 min-w-[14rem] flex-1 sm:max-w-[22rem]" label={m.countingRows} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled>
            {m.measure}
          </Button>
          <span className="text-[0.9rem] text-ink-dim">{m.measureHint}</span>
        </div>
      </div>
      <Skeleton className="h-[26rem] w-full rounded-[0.45rem]" />
      <DisclosureSkeleton chars={24} />
    </Frame>
  )
}

function Frame({
  count,
  className,
  children,
}: {
  count: number | null
  className?: string
  children: React.ReactNode
}) {
  const m = useMessages(storageMessages)
  return (
    <section aria-labelledby="tables-title" className={cx("flex flex-col gap-3", className)}>
      <SectionTitle as="h3" id="tables-title">
        {m.tables}
        {count !== null && <span className="ml-2 font-mono text-[0.9rem] font-normal text-ink-dim">{count}</span>}
      </SectionTitle>
      {children}
    </section>
  )
}

function MeasureSizes({ measured }: { measured: boolean }) {
  const measuring = useStorage((s) => s.measuring)
  const measuredIn = useStorage((s) => s.measuredIn)
  const measureSizes = useStorage((s) => s.measureSizes)
  const elapsed = useElapsed(measuring)
  const m = useMessages(storageMessages)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={measureSizes} disabled={measuring !== null}>
        {measuring !== null ? m.measuring : measured ? m.measureAgain : m.measure}
      </Button>
      <span className="text-[0.9rem] text-ink-dim" role="status">
        {measuring !== null
          ? m.readingPages(<span className="font-mono tabular-nums">{m.duration(elapsed)}</span>)
          : measured && measuredIn !== null
            ? m.measuredIn(<span className="font-mono tabular-nums">{m.duration(measuredIn)}</span>)
            : m.measureHint}
      </span>
    </div>
  )
}

/** One choice per group the store has, with its tables and, once measured, their size. */
function GroupFilter(props: {
  tables: Table[]
  value: TableGroup | null
  onChange: (group: TableGroup | null) => void
  measured: boolean
}) {
  const { tables, value, onChange, measured } = props
  const m = useMessages(storageMessages)
  const present = TABLE_GROUPS.map((g) => ({ g, of: tables.filter((t) => groupOf(t) === g) })).filter(
    (x) => x.of.length > 0,
  )
  const choices: { g: TableGroup | null; label: string; of: Table[] }[] = [
    { g: null, label: m.allTables, of: tables },
    ...present.map(({ g, of }) => ({ g, label: m.tableGroup[g], of })),
  ]
  return (
    <Segmented<TableGroup | "all">
      size="md"
      label={m.tableGroups}
      value={value ?? "all"}
      onChange={(g) => onChange(g === "all" ? null : g)}
      options={choices.map(({ g, label, of }) => ({
        value: g ?? "all",
        label,
        count: measured ? `${of.length} · ${formatBytes(totalBytes(of))}` : of.length,
      }))}
    />
  )
}

function TableOf(props: {
  tables: Table[]
  typeOf: (t: Table) => string
  sort: TableSort
  onSort: (key: TableSort["key"]) => void
  label: string
  measured: boolean
}) {
  const { tables, typeOf, sort, onSort, label, measured } = props
  const m = useMessages(storageMessages)
  if (tables.length === 0) return null
  return (
    <div className="max-h-[26rem] overflow-auto rounded-[0.45rem] border border-line">
      <table aria-label={label} className="w-full text-[0.9rem]">
        <thead className="sticky top-0 bg-app-2">
          <tr className="border-line border-b text-left text-[0.9rem] text-ink-dim">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort.key === c.key ? (sort.descending ? "descending" : "ascending") : undefined}
                className={`px-3 py-[0.45rem] font-medium ${c.numeric ? "text-right" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="inline-flex items-center gap-1 rounded-[0.3rem] hover:text-ink"
                >
                  {m.column[c.key]}
                  {sort.key === c.key &&
                    (sort.descending ? (
                      <ArrowDown className="size-[0.85rem]" aria-hidden />
                    ) : (
                      <ArrowUp className="size-[0.85rem]" aria-hidden />
                    ))}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.name} className="border-line border-t first:border-t-0">
              <th scope="row" className="selectable px-3 py-[0.35rem] text-left font-mono text-[0.9rem] font-normal">
                {t.name}
              </th>
              <td className="px-3 py-[0.35rem] text-ink-soft">{typeOf(t)}</td>
              <td className="px-3 py-[0.35rem] text-right font-mono tabular-nums">
                {t.rows === null ? <span className="text-ink-dim">—</span> : formatNumber(t.rows)}
              </td>
              <td className="px-3 py-[0.35rem] text-right font-mono tabular-nums">
                {measured && t.bytes !== null ? formatBytes(t.bytes) : <span className="text-ink-dim">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
