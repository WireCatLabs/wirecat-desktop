import { Columns3, Handshake, RefreshCw, UserRoundPlus } from "lucide-react"
import { crmToolOf } from "@/domain/catalog"
import { inScope, KINDS, type Kind, matches } from "@/domain/clients"
import { gapFromRead } from "@/domain/needs"
import { crmNeed, ToolNeeded, useNeed } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { CrmPipeline } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Segmented } from "@/ui/Segmented"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { type Based, type Ready, readAgain, useBoard } from "./api"
import { BaseBoard } from "./BaseBoard"
import { CardDialog } from "./CardDialog"
import { ClientsBoard } from "./ClientsBoard"
import { BaseFilters, ClientsFilters } from "./Filters"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { StageMapDialog } from "./StageMapDialog"
import { useClients } from "./store"

const ICONS: Record<Kind, typeof Handshake> = { deal: Handshake, lead: UserRoundPlus }

export function ClientsPage() {
  const m = useMessages(clientMessages)
  const kind = useClients((s) => s.kind)
  const pipeline = useClients((s) => s.pipeline[kind] ?? null)
  const board = useBoard(kind, pipeline)
  const usable = board.data?.kind === "ready" || board.data?.kind === "base"
  const sm = useMessages(stageMessages)
  const waiting = board.data?.kind === "base" ? board.data.unsorted.stages : 0
  return (
    <div className="flex min-w-0 flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] leading-none font-extrabold tracking-[-0.035em]">{m.title}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">{m.intro}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={board.isFetching}
            onClick={() => void readAgain()}
            className={cx(!usable && "invisible")}
            icon={<RefreshCw className={cx("size-4", board.isFetching && "motion-safe:animate-spin")} aria-hidden />}
          >
            <StableText value={board.isFetching ? m.reading : m.readAgain} variants={[m.reading, m.readAgain]} />
          </Button>
          {board.data?.kind === "base" && (
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
        </div>
      </div>
      {usable && <CrmNeeded />}
      <Body />
      <CardDialog />
      <StageMapDialog />
    </div>
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
  if (data.pipelines.length === 0) {
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.3rem] text-[0.95rem] text-ink-soft">
        <p className="font-medium text-ink">{m.none[kind]}</p>
        <p className="mt-1 max-w-[70ch]">{m.noneBody[kind]}</p>
      </div>
    )
  }
  if (data.kind === "base") return <BaseLoaded read={data} kind={kind} />
  return <Loaded read={data} kind={kind} />
}

function BaseLoaded({ read, kind }: { read: Based; kind: Kind }) {
  const m = useMessages(clientMessages)
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
      <BaseBoard read={read} kind={kind} cards={shown} filtered={filtered} />
    </>
  )
}

function Loaded({ read, kind }: { read: Ready; kind: Kind }) {
  const m = useMessages(clientMessages)
  const query = useClients((s) => s.query)
  const shown = read.cards.filter((c) => matches(c, query))
  return (
    <>
      <ClientsFilters read={read} kind={kind} />
      {read.more && <p className="-mt-[0.6rem] text-[0.9rem] text-ink-soft">{m.more(read.cards.length)}</p>}
      <ReadOnly pipeline={read.pipelines.find((p) => p.ref === read.pipeline && p.movable.kind === "no")} />
      {query.trim() && shown.length === 0 && (
        <p className="-mt-[0.6rem] text-[0.9rem] text-ink-soft">
          {m.noMatch}{" "}
          <Button size="sm" variant="ghost" onClick={() => useClients.getState().setQuery("")}>
            {m.clear}
          </Button>
        </p>
      )}
      <ClientsBoard read={read} kind={kind} cards={shown} />
    </>
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
  return (
    <>
      <div className="flex flex-col gap-[0.7rem]">
        <Skeleton className="h-[2.8rem] w-full" label={m.reading} />
        <Skeleton className="h-[1.9rem] w-[22rem]" />
      </div>
      <div className="grid grid-cols-[repeat(5,minmax(12rem,1fr))] gap-[0.75rem] overflow-hidden xl:gap-[1rem]">
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
