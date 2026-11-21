import { useId } from "react"
import { isConversation } from "@/domain/conversation"
import { groupsOf } from "@/domain/inbox"
import { linkTargetOf } from "@/domain/links"
import { openConversation } from "@/features/conversation"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import type { InboxPage, InboxThread } from "@/platform/bindings"
import { type Column, DataTable } from "@/ui/DataTable"
import { SectionTitle } from "@/ui/SectionTitle"
import { Skeleton } from "@/ui/Skeleton"
import { inboxMessages } from "./messages"

/** Opens the thread on the conversation page, as a chat link from anywhere else in the app does. */
function open(t: InboxThread) {
  const target = linkTargetOf(t.ref)
  if (target && isConversation(target)) openConversation(target)
}

function useColumns(title: (profile: string) => string): Column<InboxThread>[] {
  const m = useMessages(inboxMessages)
  const lang = useLang()
  return [
    {
      id: "subject",
      head: m.col.subject,
      width: "minmax(0,1fr)",
      lead: true,
      cell: (t) => (
        <button
          type="button"
          aria-label={m.open(t.title ?? m.noSubject)}
          onClick={(e) => {
            e.stopPropagation()
            open(t)
          }}
          className="flex min-w-0 cursor-pointer flex-col text-left"
        >
          {/* The model's reading of mail other people wrote: plain text, never markup. */}
          <span className="font-medium text-ink [overflow-wrap:anywhere] group-hover:text-brand">
            {t.title ?? m.noSubject}
          </span>
          <span className="text-[0.9rem] text-ink-soft [overflow-wrap:anywhere]">{t.reason}</span>
        </button>
      ),
    },
    {
      id: "sender",
      head: m.col.sender,
      width: "minmax(8rem,0.45fr)",
      // The name the sender gave himself is other people's text too: plain text, never markup.
      cell: (t) =>
        t.sender ? (
          <span title={t.sender.address} className="text-ink-soft [overflow-wrap:anywhere]">
            {t.sender.name ?? t.sender.address}
          </span>
        ) : null,
    },
    {
      id: "account",
      head: m.col.account,
      width: "minmax(7rem,0.35fr)",
      cell: (t) => <span className="text-ink-soft [overflow-wrap:anywhere]">{title(t.profile)}</span>,
    },
    {
      id: "time",
      head: m.col.time,
      width: "minmax(8rem,0.35fr)",
      cell: (t) => (
        <time dateTime={t.lastEmailAt} className="text-ink-soft tabular-nums">
          {ago(t.lastEmailAt, Date.now(), lang)}
        </time>
      ),
    },
  ]
}

const TABLE = { density: "roomy", minWidth: "52rem", leadWidth: "minmax(16rem,1fr)" } as const

/** One page of sorted threads, under the group each is in; a group's heading counts all of it, on every page. */
export function InboxGroups(props: { page: InboxPage; busy: boolean; title: (profile: string) => string }) {
  const { page, busy, title } = props
  const m = useMessages(inboxMessages)
  const lang = useLang()
  const columns = useColumns(title)
  return (
    <div className="flex flex-col gap-[1.5rem]">
      {groupsOf(page).map((g) => (
        <Group key={g.bucket} name={m.groups[g.bucket]} count={formatNumber(g.total, lang)}>
          {(label) => (
            <DataTable
              label={label}
              rows={g.threads}
              rowKey={(t) => `${t.profile}|${t.ref}`}
              columns={columns}
              {...TABLE}
              onRowClick={open}
              busy={busy}
            />
          )}
        </Group>
      ))}
    </div>
  )
}

function Group(props: { name: string; count: string; children: (label: string) => React.ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-[0.5rem]">
      <SectionTitle id={id} className="flex items-baseline gap-2">
        {props.name}
        <span className="text-ink-dim tabular-nums">{props.count}</span>
      </SectionTitle>
      {props.children(props.name)}
    </section>
  )
}

/** The first group while the accounts are read: its heading and rows at their loaded heights. */
export function InboxGroupsLoading({ label }: { label: string }) {
  const columns = useColumns((p) => p)
  return (
    <section className="flex flex-col gap-[0.5rem]">
      <Skeleton className="h-[1.3rem] w-[10rem]" />
      <DataTable
        label={label}
        rows={[]}
        rowKey={() => ""}
        columns={columns}
        {...TABLE}
        placeholders={8}
        loading={label}
      />
    </section>
  )
}
