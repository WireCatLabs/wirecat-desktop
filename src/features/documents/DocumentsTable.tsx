import { FileAudio, FileImage, FileSpreadsheet, FileText, Globe, Presentation } from "lucide-react"
import type { ReactNode } from "react"
import { documentName } from "@/domain/documents"
import { formatBytes } from "@/domain/format"
import { setField, valuesOf } from "@/domain/query-terms"
import { formatWhen } from "@/domain/runs"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { DocumentRow, DocumentSource } from "@/platform/bindings"
import { errorText } from "@/shared/errors"
import { PageError } from "@/shared/PageError"
import { SourceIcon } from "@/shared/SourceIcon"
import { Button } from "@/ui/Button"
import { type Column, DataTable } from "@/ui/DataTable"
import { EmptyState } from "@/ui/EmptyState"
import { FilterBar, ToggleChip } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import type { useDocumentsPage } from "./api"
import { DOCUMENT_KINDS, type DocumentKind, documentMessages } from "./messages"
import { useDocuments } from "./store"

const ICON = "size-4 shrink-0 text-ink-dim"
const KIND_ICON: Partial<Record<DocumentKind, ReactNode>> = {
  transcript: <FileAudio className={ICON} aria-hidden />,
  sheet: <FileSpreadsheet className={ICON} aria-hidden />,
  xlsx: <FileSpreadsheet className={ICON} aria-hidden />,
  csv: <FileSpreadsheet className={ICON} aria-hidden />,
  slides: <Presentation className={ICON} aria-hidden />,
  pptx: <Presentation className={ICON} aria-hidden />,
  image: <FileImage className={ICON} aria-hidden />,
  page: <Globe className={ICON} aria-hidden />,
  html: <Globe className={ICON} aria-hidden />,
}
export const kindIcon = (kind: string) => KIND_ICON[kind as DocumentKind] ?? <FileText className={ICON} aria-hidden />

/** The search with its chips, the list memo cut into pages, and the pager. */
export function DocumentsTable({
  sources,
  list,
}: {
  sources: readonly DocumentSource[] | null
  list: ReturnType<typeof useDocumentsPage>
}) {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const query = useDocuments((s) => s.query)
  const asked = useDocuments((s) => s.asked)
  const page = useDocuments((s) => s.page)
  const size = useDocuments((s) => s.size)
  const { type, setQuery, setPage, setSize, reveal } = useDocuments.getState()
  const columns = useColumns()
  const data = list.data
  const field = (name: string, values: string[]) => setQuery(setField(query, name, values))

  const filters = (
    <FilterBar
      inline
      query={query}
      onQuery={type}
      onClear={() => setQuery("")}
      label={m.search}
      placeholder={m.searchHint}
    >
      <FilterMenu
        label={m.kind}
        single
        search
        options={DOCUMENT_KINDS.map((k) => ({ value: k, label: m.kinds[k], icon: kindIcon(k) }))}
        selected={valuesOf(query, "kind")}
        onChange={(v) => field("kind", v)}
      />
      <FilterMenu
        label={m.source}
        single
        options={(sources ?? []).map((s) => ({
          value: s.source,
          label: s.label,
          icon: <SourceIcon provider={s.provider} />,
          count: s.count,
        }))}
        selected={valuesOf(query, "source")}
        // Another account's folders are not this one's: the folder goes with the account it was in.
        onChange={(v) => setQuery(setField(query, "source", v, "source|folder"))}
      />
      <ToggleChip
        on={valuesOf(query, "has_text").includes("true")}
        onChange={(on) => field("has_text", on ? ["true"] : [])}
      >
        {m.withText}
      </ToggleChip>
      {data && (
        <span className="ml-auto font-mono text-[0.85rem] text-ink-dim tabular-nums">
          {m.found(data.total, `${formatNumber(data.total, lang)}${data.totalMore ? "+" : ""}`)}
        </span>
      )}
    </FilterBar>
  )

  let body: ReactNode
  if (list.error)
    body = (
      <PageError raw={errorText(list.error)} what="Listing documents" onRetry={() => void list.refetch()}>
        {m.readFailed}
      </PageError>
    )
  else if (data && data.documents.length === 0)
    body = asked ? (
      <EmptyState
        action={
          <Button size="sm" onClick={() => setQuery("")}>
            {m.clear}
          </Button>
        }
      >
        {m.noMatch}
      </EmptyState>
    ) : (
      <EmptyState title={m.emptyTitle}>{m.emptyBody}</EmptyState>
    )
  else
    body = (
      <DataTable
        label={m.rows}
        busy={list.isFetching}
        rows={data?.documents ?? []}
        rowKey={(d) => d.ref}
        columns={columns}
        density="compact"
        minWidth="42rem"
        placeholders={data ? 0 : 8}
        loading={m.reading}
        onRowClick={(d) => reveal(d.ref, documentName(d))}
      />
    )

  return (
    <section aria-label={m.rows} className="flex min-w-0 flex-col gap-[0.8rem]">
      {filters}
      {body}
      {data && (page > 1 || data.more || data.total > PAGE_SIZES[0]) && (
        <Pager
          page={page}
          onPage={setPage}
          busy={list.isFetching}
          total={data.total}
          totalMore={data.totalMore}
          size={size}
          sizes={PAGE_SIZES}
          onSize={setSize}
        />
      )}
    </section>
  )
}

function useColumns(): Column<DocumentRow>[] {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const now = new Date()
  const c = m.columns
  return [
    { id: "name", head: c.name, width: "minmax(11rem,1fr)", cell: (d) => <Name doc={d} /> },
    {
      id: "kind",
      head: c.kind,
      width: "7.5rem",
      className: "truncate text-ink-soft",
      cell: (d) => m.kinds[d.kind as DocumentKind] ?? d.kind,
    },
    {
      id: "where",
      head: c.where,
      width: "minmax(7rem,13rem)",
      cell: (d) => (
        <span className="flex min-w-0 items-center gap-[0.45rem]">
          <SourceIcon provider={d.source.provider} label={d.source.label} labelled />
          <span className="selectable truncate font-mono text-[0.88rem] text-ink-soft">{d.folder ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "changed",
      head: c.changed,
      width: "8.5rem",
      className: "truncate font-mono text-[0.9rem] tabular-nums text-ink-soft",
      cell: (d) => {
        const at = d.sourceModifiedAt ?? d.storedAt
        return at ? formatWhen(at, now, lang) : "—"
      },
    },
    {
      id: "size",
      head: c.size,
      width: "5.5rem",
      className: "text-right font-mono text-[0.9rem] tabular-nums text-ink-soft",
      cell: (d) => (d.size === null ? "—" : formatBytes(d.size)),
    },
  ]
}

function Name({ doc }: { doc: DocumentRow }) {
  return (
    <button
      type="button"
      data-opens={doc.ref}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.stopPropagation()
        useDocuments.getState().reveal(doc.ref, documentName(doc))
      }}
      className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-rack text-left focus-visible:outline-2 focus-visible:outline-brand"
    >
      {kindIcon(doc.kind)}
      <span className="truncate font-medium group-hover:text-brand">{documentName(doc)}</span>
    </button>
  )
}
