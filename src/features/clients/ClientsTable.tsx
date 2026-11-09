import { columnOf, UNSORTED } from "@/domain/base-stages"
import { crmToolOf } from "@/domain/catalog"
import { accountKey, type Kind, moneyOf } from "@/domain/clients"
import { formatDate, type Lang, useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { ToolIcon } from "@/shared/ToolIcon"
import { type Column, DataTable } from "@/ui/DataTable"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { Select } from "@/ui/Select"
import type { Based } from "./api"
import { Refused } from "./BaseBoard"
import { useBaseMove } from "./base-move"
import { OutcomeLamp } from "./Card"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { tableMessages } from "./messages-table"
import { useClients } from "./store"

/** A CRM's change is news by the day, not the second: the time today, the date before, the year once it differs. */
function updatedOf(iso: string, now: Date, lang: Lang) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (d.toDateString() === now.toDateString()) return formatDate(d, { hour: "2-digit", minute: "2-digit" }, lang)
  const year = d.getFullYear() === now.getFullYear() ? undefined : "numeric"
  return formatDate(d, { day: "numeric", month: "short", year }, lang)
}

const BARE = "w-full border-transparent! bg-transparent! hover:bg-app-3! -ml-[0.45rem] pl-[0.45rem]!"

/** Every pipeline's cards as rows; the stage cell moves a card the way a drop on the board does. */
export function ClientsTable({ read, kind, cards }: { read: Based; kind: Kind; cards: CrmCard[] }) {
  const m = useMessages(clientMessages)
  const t = useMessages(tableMessages)
  const s = useMessages(stageMessages)
  const lang = useLang()
  const page = useClients((st) => st.page)
  const size = useClients((st) => st.pageSize)
  const failed = useClients((st) => st.failed)
  const refused = useClients((st) => st.refused)
  const move = useBaseMove(read, kind)
  const pipes = new Map(read.pipelines.map((p) => [p.ref, p]))
  const position = (c: CrmCard) => read.base.findIndex((b) => b.ref === columnOf(c))
  const now = new Date()
  const columns: Column<CrmCard>[] = [
    {
      id: "title",
      head: t.title,
      width: "minmax(0,1fr)",
      lead: true,
      cell: (c) => (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => useClients.getState().setOpen(c.ref)}
          className="block w-full min-w-0 cursor-pointer truncate rounded-[0.2rem] text-left font-medium group-hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
        >
          {c.title}
        </button>
      ),
    },
    {
      id: "stage",
      head: t.stage,
      width: "10rem",
      sortBy: position,
      cell: (c) => (
        <Select
          size="sm"
          aria-label={t.stageOf(c.title)}
          value={columnOf(c)}
          disabled={!move.movable(c)}
          onChange={(to: string) => move.moveTo(c, to)}
          options={[
            ...(columnOf(c) === UNSORTED ? [{ value: UNSORTED, label: s.unsorted, disabled: true }] : []),
            ...read.base.map((b) => ({ value: b.ref, label: b.name, icon: <OutcomeLamp outcome={b.outcome} /> })),
          ]}
          className={BARE}
        />
      ),
    },
    {
      id: "amount",
      head: t.amount,
      width: "8.5rem",
      // A card without an amount sorts after every amount.
      sortBy: (c) => (c.amount ? Number.parseFloat(c.amount) : Number.POSITIVE_INFINITY),
      className: "truncate font-mono text-[0.9rem] tabular-nums",
      cell: (c) => (c.amount && c.currency ? moneyOf(c.amount, c.currency, lang) : "—"),
    },
    {
      id: "pipeline",
      head: t.pipeline,
      width: "10rem",
      cell: (c) => {
        const p = pipes.get(c.pipeline)
        const tool = p?.account ? crmToolOf(p.account.provider) : undefined
        return (
          <span className="flex min-w-0 items-center gap-[0.4rem] text-ink-soft">
            {tool && <ToolIcon id={tool.id} className="size-4 shrink-0" />}
            <span className="truncate">{p?.name ?? c.pipeline}</span>
          </span>
        )
      },
    },
    {
      id: "contact",
      head: t.contact,
      width: "10rem",
      className: "truncate text-ink-soft",
      cell: (c) => c.organization ?? c.people[0]?.name ?? "—",
    },
    {
      id: "updated",
      head: t.updated,
      width: "7rem",
      sortBy: (c) => c.updatedAt,
      className: "truncate font-mono text-[0.9rem] tabular-nums text-ink-soft",
      cell: (c) => (c.updatedAt ? updatedOf(c.updatedAt, now, lang) : "—"),
    },
  ]
  return (
    <>
      <DataTable
        label={m.kinds[kind]}
        rows={cards}
        rowKey={(c) => c.ref}
        columns={columns}
        leadWidth="minmax(14rem,1fr)"
        minWidth="62rem"
        page={{ index: page, size }}
        below={(c) =>
          failed[c.ref] || refused[c.ref] ? (
            <div className="sticky left-0 flex w-fit max-w-[58rem] flex-col gap-1 px-[1.3rem] pb-[0.6rem]">
              {failed[c.ref] && <ErrorNotice inline>{m.notMoved(failed[c.ref] ?? "")}</ErrorNotice>}
              {refused[c.ref] && <Refused why={refused[c.ref] ?? "unmapped"} account={accountKey(c.account)} />}
            </div>
          ) : null
        }
      />
      {cards.length > PAGE_SIZES[0] && (
        <Pager
          page={page}
          onPage={(p) => useClients.getState().setPage(p)}
          total={cards.length}
          size={size}
          sizes={PAGE_SIZES}
          onSize={(s) => useClients.getState().setPageSize(s)}
        />
      )}
    </>
  )
}
