import { Columns3, Handshake, ListChecks, Rows3, UserRoundPlus } from "lucide-react"
import { useEffect } from "react"
import { crmsOf } from "@/domain/base-stages"
import { crmToolOf } from "@/domain/catalog"
import { inScope, KINDS, type Kind, matches } from "@/domain/clients"
import { gapFromRead } from "@/domain/needs"
import { crmNeed, ToolNeeded, useNeed } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { CrmPipeline } from "@/platform/bindings"
import { Page, PageHeader } from "@/shared/Page"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { RefreshButton } from "@/ui/RefreshButton"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { type Based, readAgain, useBoard } from "./api"
import { BaseBoard } from "./BaseBoard"
import { MovePickers } from "./base-move"
import { CardDialog } from "./CardDialog"
import { ClientsTable, ClientsTableLoading } from "./ClientsTable"
import { BaseFilters } from "./Filters"
import { ImportButton } from "./ImportButton"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { tableMessages } from "./messages-table"
import { StageMapDialog } from "./StageMapDialog"
import { useClients, type View } from "./store"

const ICONS: Record<Kind, typeof Handshake> = { deal: Handshake, lead: UserRoundPlus }
const VIEWS: Record<View, typeof Handshake> = { table: Rows3, board: Columns3 }

export function ClientsPage() {
  const m = useMessages(clientMessages)
  const kind = useClients((s) => s.kind)
  const pipeline = useClients((s) => s.pipeline[kind] ?? null)
  const board = useBoard(kind, pipeline)
  const view = useClients((s) => s.view)
  const sm = useMessages(stageMessages)
  const waiting = board.data?.kind === "base" ? board.data.unsorted.stages : 0
  const t = useMessages(tableMessages)
  const based = board.data?.kind === "base"
  return (
    <Page fill={view === "board"}>
      <PageHeader
        title={m.title}
        section="clients"
        intro={m.intro}
        compact
        actions={
          <>
            <RefreshButton
              busy={board.isFetching}
              onClick={() => void readAgain()}
              label={m.readAgain}
              busyLabel={m.reading}
              className={cx(!based && "invisible")}
            />
            {based && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={waiting > 0 ? sm.mapWaiting(waiting) : undefined}
                onClick={() => useClients.getState().openMap("")}
                icon={<Columns3 className="size-4" aria-hidden />}
              >
                {sm.mapStages}
                {waiting > 0 && <Pill tone="warn">{waiting}</Pill>}
              </Button>
            )}
            {based && (
              <Segmented<View>
                size="md"
                label={t.view}
                value={view}
                onChange={(v) => useClients.getState().setView(v)}
                options={(["table", "board"] as const).map((v) => {
                  const Icon = VIEWS[v]
                  return { value: v, label: t[v], icon: <Icon className="size-4" aria-hidden /> }
                })}
              />
            )}
            <Segmented<Kind>
              label={m.kind}
              value={kind}
              onChange={(k) => useClients.getState().setKind(k)}
              labelClass=""
              options={KINDS.map((k) => {
                const Icon = ICONS[k]
                return { value: k, label: m.kinds[k], icon: <Icon className="size-4" aria-hidden /> }
              })}
            />
            {based && <ImportButton />}
          </>
        }
      />
      {based && <CrmNeeded />}
      {board.data?.kind === "base" && <StagesToConfirm read={board.data} kind={kind} />}
      <Body />
      <CardDialog />
      <StageMapDialog />
    </Page>
  )
}

/**
 * A CRM's stages are memo's guesses until the owner confirms them, and its cards wait in Unsorted until then. The first
 * read that brings such stages opens the dialog by itself, once per CRM and kind (every new CRM at once, one dialog); the notice stays until none is left.
 */
function StagesToConfirm({ read, kind }: { read: Based; kind: Kind }) {
  const s = useMessages(stageMessages)
  const crms = crmsOf(read.pipelines, read.mapping)
  const waiting = [...crms.values()].reduce((n, c) => n + c.waiting, 0)
  const prompted = useClients((st) => st.prompted)
  const mapOn = useClients((st) => st.mapOn)
  const fresh = [...crms]
    .filter(([key, c]) => c.waiting > 0 && !prompted.includes(`${kind}:${key}`))
    .map(([key]) => `${kind}:${key}`)
    .join("\n")
  useEffect(() => {
    if (fresh && mapOn === null) useClients.getState().prompt(fresh.split("\n"))
  }, [fresh, mapOn])
  if (waiting === 0) return null
  return (
    <ErrorNotice
      tone="warn"
      detail={s.toConfirmBody}
      action={
        <Button
          size="sm"
          variant="primary"
          icon={<ListChecks className="size-4" aria-hidden />}
          onClick={() => useClients.getState().openMap("")}
        >
          {s.confirmStages}
        </Button>
      }
    >
      <span className="font-medium text-ink">{s.toConfirm(waiting)}</span>
    </ErrorNotice>
  )
}

/** The owner's own deals work without one; a CRM is where most of them come from. */
function CrmNeeded() {
  const m = useMessages(clientMessages)
  const gap = useNeed(crmNeed())
  // The tools are found apart from memo's read, so the notice may come after the board: it opens, never pops in.
  return <Collapse open={gap !== null}>{gap && <ToolNeeded gap={gap}>{m.crmWhy}</ToolNeeded>}</Collapse>
}

function Body() {
  const m = useMessages(clientMessages)
  const kind = useClients((s) => s.kind)
  const pipeline = useClients((s) => s.pipeline[kind] ?? null)
  const { data, error, isPending } = useBoard(kind, pipeline)

  if (error) {
    return (
      <ErrorNotice
        detail={error.message}
        action={
          <Button size="sm" onClick={() => void readAgain()}>
            {m.tryAgain}
          </Button>
        }
      >
        {m.readFailed}
      </ErrorNotice>
    )
  }
  if (isPending || !data) return <Loading />
  if (data.kind === "missing" || data.kind === "old") {
    const gap = gapFromRead(data)
    return gap && <ToolNeeded gap={gap} />
  }
  if (data.kind === "base" && data.cards.length === 0) {
    return <Empty kind={kind} synced={data.pipelines.some((p) => p.account !== null)} />
  }
  if (data.pipelines.length === 0) {
    return <EmptyState title={m.none[kind]}>{m.noneBody[kind]}</EmptyState>
  }
  return <BaseLoaded read={data} kind={kind} />
}

function BaseLoaded({ read, kind }: { read: Based; kind: Kind }) {
  const m = useMessages(clientMessages)
  const view = useClients((s) => s.view)
  const query = useClients((s) => s.query)
  const pipelines = useClients((s) => s.pipelines)
  const accounts = useClients((s) => s.accounts)
  const shown = read.cards.filter((c) => inScope(c, pipelines, accounts) && matches(c, query))
  const filtered = query.trim() !== "" || pipelines.length > 0 || accounts.length > 0
  return (
    <>
      <BaseFilters read={read} shown={shown} />
      {read.more && <p className="-mt-[0.6rem] text-[0.9rem] text-ink-soft">{m.more(read.cards.length)}</p>}
      <ReadOnly
        pipeline={read.pipelines.find((p) => p.movable.kind === "no" && shown.some((c) => c.pipeline === p.ref))}
      />
      {filtered && shown.length === 0 && (
        <p className="-mt-[0.6rem] text-[0.9rem] text-ink-soft">
          {m.noMatch}{" "}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => useClients.setState({ query: "", pipelines: [], accounts: [] })}
          >
            {m.clear}
          </Button>
        </p>
      )}
      {view === "table" ? (
        <ClientsTable read={read} kind={kind} cards={shown} />
      ) : (
        <BaseBoard read={read} kind={kind} cards={shown} filtered={filtered} />
      )}
      <MovePickers read={read} kind={kind} cards={read.cards} />
    </>
  )
}

/** No card of this kind yet: the three reasons that is so without anything being broken, each with its way out. */
function Empty({ kind, synced }: { kind: Kind; synced: boolean }) {
  const m = useMessages(clientMessages)
  const t = useMessages(tableMessages)
  const other = KINDS.find((k) => k !== kind) ?? kind
  return (
    <EmptyState title={m.none[kind]}>
      <div className="mt-[0.7rem] flex flex-wrap items-center gap-3">
        <p>{t.notImported}</p>
        <ImportButton />
      </div>
      {synced && <p className="mt-[0.7rem]">{t.emptyScope}</p>}
      <div className="mt-[0.7rem] flex flex-wrap items-center gap-3">
        <p>{t.elsewhere[kind]}</p>
        <Button size="sm" variant="ghost" onClick={() => useClients.getState().setKind(other)}>
          {t.showOther[kind]}
        </Button>
      </div>
    </EmptyState>
  )
}

/** Why a CRM's cards stay put: its CLI is missing or too old, or memo names none the app can run. */
function ReadOnly({ pipeline }: { pipeline: CrmPipeline | undefined }) {
  const m = useMessages(clientMessages)
  if (pipeline?.movable.kind !== "no") return null
  const why = pipeline.movable.why
  const tool = pipeline.account ? crmToolOf(pipeline.account.provider)?.name : undefined
  const text =
    tool && why === "crmCliMissing"
      ? m.readOnlyInstall(tool)
      : tool && why === "crmCliOld"
        ? m.readOnlyUpdate(tool)
        : m.readOnly
  return <p className="-mt-[0.6rem] max-w-[80ch] text-[0.9rem] text-ink-soft">{text}</p>
}

/** The filters and the columns at their final size, so nothing below moves when memo answers. */
function Loading() {
  const m = useMessages(clientMessages)
  const kind = useClients((s) => s.kind)
  const table = useClients((s) => s.view === "table")
  return table ? (
    <>
      <div className="flex flex-col gap-[0.7rem]">
        <Skeleton className="h-[2.8rem] w-full" />
        <Skeleton className="h-[1.9rem] w-[22rem]" />
      </div>
      <ClientsTableLoading kind={kind} label={m.reading} />
    </>
  ) : (
    <>
      <div className="flex flex-col gap-[0.7rem]">
        <Skeleton className="h-[2.8rem] w-full" label={m.reading} />
        <Skeleton className="h-[1.9rem] w-[22rem]" />
      </div>
      <div className="grid min-h-[22rem] flex-1 grid-cols-[repeat(5,minmax(12rem,1fr))] gap-[0.75rem] overflow-hidden xl:gap-[1rem]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-[22rem] flex-col rounded-[0.2rem] border border-line-strong bg-app">
            <div className="flex min-h-[3rem] items-center border-line border-b px-[0.9rem]">
              <Skeleton className="h-[1rem] w-[60%]" />
            </div>
            <div className="flex flex-col gap-[0.8rem] p-[0.9rem]">
              <Skeleton className="h-[3.4rem] w-full" />
              <Skeleton className="h-[3.4rem] w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
