import { Filter, FilterX, Group } from "lucide-react"
import { type ReactNode, useState } from "react"
import { formatWhen } from "@/domain/runs"
import { type HitFile, type HitRow, hitRow } from "@/domain/search"
import { hitLink } from "@/domain/search-context"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { SearchHit } from "@/platform/search-schemas"
import { CopyValue, type FieldOf, JsonTree } from "@/shared/JsonTree"
import { sharedMessages } from "@/shared/messages"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { type Column, DataTable } from "@/ui/DataTable"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { selectsTextIn } from "@/ui/selection"
import { searchMessages } from "./messages"

type Props = {
  hits: SearchHit[]
  /** Rows held at the real row height while the first answer is on its way. */
  placeholders?: number
  busy?: boolean
  now: Date
  expanded: string | null
  onToggle: (key: string) => void
  fieldOf?: FieldOf
  onFilter?: (field: string, value: string, negate: boolean) => void
  onGroup?: (field: string) => void
  /** What a result leads to, above its details. */
  actions?: (hit: SearchHit) => ReactNode
}

const FULL: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "long" }
const none = () => null
const nothing = () => {}

type Item = { hit: SearchHit; row: HitRow; key: string }

const CELL = "truncate"

export function HitsTable(props: Props) {
  const { hits, placeholders = 0, busy = false, now, expanded, onToggle } = props
  const { fieldOf = none, onFilter = nothing, onGroup = nothing } = props
  const m = useMessages(searchMessages)
  const lang = useLang()
  const items = hits.map((hit, i): Item => {
    const row = hitRow(hit, i)
    return { hit, row, key: `${i}:${row.key}` }
  })
  const columns: Column<Item>[] = [
    {
      id: "when",
      head: m.when,
      width: "8.3rem",
      className: "truncate whitespace-nowrap font-mono text-[0.9rem] text-ink-soft tabular-nums",
      cell: ({ row }) => (
        <span title={row.when ? formatDate(row.when, FULL, lang) : undefined}>
          {row.when ? formatWhen(row.when, now, lang) : "—"}
        </span>
      ),
    },
    {
      id: "where",
      head: m.where,
      width: "var(--where)",
      className: cx(CELL, "font-medium"),
      cell: ({ row }) => (
        <span title={row.where ?? undefined}>{row.where ?? <span className="font-normal text-ink-dim">—</span>}</span>
      ),
    },
    {
      id: "who",
      head: m.who,
      width: "var(--who)",
      className: cx(CELL, "text-ink-soft"),
      cell: ({ row }) => (
        <span title={row.who ?? undefined}>
          {row.fromMe ? m.you : (row.who ?? <span className="text-ink-dim">—</span>)}
        </span>
      ),
    },
    {
      id: "text",
      head: m.text,
      width: "minmax(0,1fr)",
      className: CELL,
      cell: ({ row }) => (
        <span title={row.text ?? filesText(row.files, m) ?? undefined}>
          {row.text ??
            (row.files.length > 0 ? (
              <span className="text-ink-soft italic">{filesText(row.files, m)}</span>
            ) : (
              <span className="text-ink-dim">—</span>
            ))}
        </span>
      ),
    },
    {
      id: "open",
      head: m.hitDetail,
      hideHead: true,
      width: "1.7rem",
      cell: ({ row, key }) => {
        const open = expanded === key
        return (
          <button
            type="button"
            aria-expanded={open}
            aria-label={(open ? m.hideHit : m.showHit)(row.where ?? row.text ?? row.key)}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(key)
            }}
            className="grid size-[1.5rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
          >
            <ExpandChevron open={open} />
          </button>
        )
      },
    },
  ]
  return (
    <div className="[--where:7.1rem] [--who:5.6rem] lg:[--where:12.1rem] lg:[--who:9.1rem]">
      <DataTable
        density="compact"
        rows={items}
        rowKey={(r) => r.key}
        columns={columns}
        minWidth="36rem"
        busy={busy}
        placeholders={placeholders}
        loading={m.loadingHits}
        onRowClick={(r, e) => {
          if (!selectsTextIn(e.currentTarget)) onToggle(r.key)
        }}
        selected={(r) => expanded === r.key}
        below={({ hit, row, key }) => {
          const open = expanded === key
          return (
            <div className={cx(open && "border-line border-b")}>
              <Collapse open={open}>
                <div data-tour={open ? "search-hit" : undefined} className="bg-app-2/60 px-[1.3rem] py-[0.9rem]">
                  {open && props.actions?.(hit)}
                  <HitFields hit={hit} row={row} fieldOf={fieldOf} onFilter={onFilter} onGroup={onGroup} />
                  <RawData hit={hit} fieldOf={fieldOf} onFilter={onFilter} onGroup={onGroup} />
                </div>
              </Collapse>
            </div>
          )
        }}
      />
    </div>
  )
}

type Words = (typeof searchMessages)["en"]

function filesText(files: HitFile[], m: Words): string | null {
  if (files.length === 0) return null
  return files.map((f) => f.name ?? m.fileKinds[f.kind] ?? m.attachment).join(", ")
}

/** Where each row's value comes from, so its filter names the same field the query does. */
function wherePath(hit: SearchHit): string[] {
  const email = hit.email
  if (email && typeof email === "object" && "subject" in email && email.subject) return ["email", "subject"]
  for (const key of ["chat_title", "title", "path"]) if (typeof hit[key] === "string" && hit[key]) return [key]
  return []
}

type FieldsProps = {
  hit: SearchHit
  row: HitRow
  fieldOf: FieldOf
  onFilter: (field: string, value: string, negate: boolean) => void
  onGroup: (field: string) => void
}

// Every value is the tool's text from the owner's own store, shown as text only: hits list such fields in
// `untrusted` for agents, which is no concern of a person reading them, so that list is never shown.
function HitFields({ hit, row, fieldOf, onFilter, onGroup }: FieldsProps) {
  const m = useMessages(searchMessages)
  const lang = useLang()
  const ref = typeof hit.ref === "string" ? hit.ref : null
  const link = hitLink(hit)
  const rows: {
    label: string
    value: string | null
    copy?: string | undefined
    path?: string[] | undefined
    mono?: boolean
  }[] = [
    { label: m.where, value: row.where, path: wherePath(hit) },
    { label: m.who, value: row.fromMe ? m.you : row.who, path: row.fromMe ? undefined : ["sender_name"] },
    { label: m.when, value: row.when ? formatDate(row.when, FULL, lang) : null, copy: row.when ?? undefined },
    { label: m.text, value: row.text },
    { label: m.files, value: filesText(row.files, m) },
    { label: m.link, value: link, mono: true },
    { label: m.reference, value: ref, mono: true },
  ]
  return (
    <dl className="selectable mb-[0.6rem] grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4">
      {rows.map((r) => {
        if (!r.value) return null
        const field = r.path ? fieldOf(r.path) : null
        return (
          <div key={r.label} className="group col-span-2 grid grid-cols-subgrid items-baseline py-[0.15rem]">
            <dt className="text-[0.9rem] text-ink-dim">{r.label}</dt>
            <dd className="flex min-w-0 items-baseline gap-2">
              <span className={cx("min-w-0 whitespace-pre-line break-words", r.mono && "font-mono text-[0.9rem]")}>
                {r.value}
              </span>
              <span className="flex shrink-0 gap-0.5 self-center opacity-0 transition-opacity duration-(--motion-fast) group-hover:opacity-100 focus-within:opacity-100">
                {field && r.value && (
                  <FieldButtons field={field} value={r.value} onFilter={onFilter} onGroup={onGroup} />
                )}
                <CopyValue value={r.copy ?? r.value} />
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

type FieldButtonsProps = { field: string; value: string } & Pick<FieldsProps, "onFilter" | "onGroup">

function FieldButtons({ field, value, onFilter, onGroup }: FieldButtonsProps) {
  const m = useMessages(sharedMessages)
  const term = `${field}:${value}`
  return (
    <>
      <IconAction label={m.filterBy(term)} onClick={() => onFilter(field, value, false)}>
        <Filter className="size-[0.85rem]" aria-hidden />
      </IconAction>
      <IconAction label={m.exclude(term)} onClick={() => onFilter(field, value, true)}>
        <FilterX className="size-[0.85rem]" aria-hidden />
      </IconAction>
      <IconAction label={m.groupByField(field)} onClick={() => onGroup(field)}>
        <Group className="size-[0.85rem]" aria-hidden />
      </IconAction>
    </>
  )
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-[1.35rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app hover:text-ink"
    >
      {children}
    </button>
  )
}

function RawData({ hit, fieldOf, onFilter, onGroup }: Omit<FieldsProps, "row">) {
  const m = useMessages(searchMessages)
  const [open, setOpen] = useState(false)
  const { untrusted: _, ...shown } = hit
  return (
    <div className="border-line border-t pt-[0.4rem]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-[0.3rem] py-[0.2rem] text-[0.9rem] text-ink-soft hover:text-ink"
      >
        {open ? m.hideRaw : m.showRaw}
        <ExpandChevron open={open} />
      </button>
      <Collapse open={open}>
        <div className="pt-[0.4rem]">
          <JsonTree value={shown} fieldOf={fieldOf} onFilter={onFilter} onGroup={onGroup} label={m.hitDetail} />
        </div>
      </Collapse>
    </div>
  )
}
