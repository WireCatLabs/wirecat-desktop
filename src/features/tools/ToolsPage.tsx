import { type ReactNode, useEffect, useId } from "react"
import { type CatalogTool, isCommunity, isOwn, isWirecatPackage, tools } from "@/domain/catalog"
import { NodeNotice } from "@/features/system"
import { useMessages } from "@/i18n"
import { useCatalog } from "@/shared/catalog-store"
import { useCompat } from "@/shared/compat-store"
import { Page, PageHeader } from "@/shared/Page"
import { ReportThis } from "@/shared/ReportThis"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { keepBelow } from "@/ui/motion"
import { RefreshButton } from "@/ui/RefreshButton"
import { Skeleton } from "@/ui/Skeleton"
import { AddOwnTool } from "./AddOwnTool"
import { InstallAll } from "./InstallAll"
import { toolsMessages } from "./messages"
import { OwnRemoved } from "./OwnRemoved"
import { OwnToolDialog } from "./OwnToolDialog"
import { StorageSummary } from "./StorageFit"
import { StoreDamageLine } from "./StoreDamage"
import { ToolRow } from "./ToolRow"
import { ToolsIntro } from "./ToolsIntro"
import { UpgradeWarning } from "./UpgradeWarning"

const GROUPS = ["official", "wirecat", "community", "own"] as const

const groupOf = (t: CatalogTool): (typeof GROUPS)[number] =>
  isOwn(t) ? (isWirecatPackage(t) ? "wirecat" : "own") : isCommunity(t) ? "community" : "official"

function ToolGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-[0.6rem]">
      <h2 id={id} className="text-[0.95rem] font-medium text-ink-soft">
        {title}
      </h2>
      <ul aria-labelledby={id} className="overflow-hidden rounded-rack border border-line-strong bg-app">
        {children}
      </ul>
    </section>
  )
}

export function ToolsPage() {
  const m = useMessages(toolsMessages).page
  // `tools` is the live list; reading the version re-renders the page when an own tool is added or removed.
  useCatalog((s) => s.version)
  const refreshing = useTools((s) => s.refreshing)
  const error = useTools((s) => s.error)
  const systemError = useSystem((s) => s.error)
  const latestUnknown = useTools((s) => s.latest !== null && Object.keys(s.latest).length === 0)
  const askingNpm = useTools((s) => s.checkingLatest)
  // The storage line answers only after every tool is found and asked, and grows a button once npm answers; its slot
  // keeps that room throughout, unless nothing is installed or no answer is coming.
  const compat = useCompat((s) => s.compat)
  const mayHaveTools = useTools((s) => !s.checked || Object.values(s.installs).some((copies) => copies.length > 0))
  const storageSlot = mayHaveTools && !error && compat !== null
  const progress = refreshing ? m.looking : askingNpm ? m.askingNpm : null
  const groups = GROUPS.map((g) => [g, tools.filter((t) => groupOf(t) === g)] as const)

  useEffect(() => {
    useTools.getState().refreshIfStale()
  }, [])

  return (
    <Page>
      <PageHeader
        title={m.title}
        status={progress}
        actions={
          <RefreshButton
            tour="check-again"
            busy={refreshing}
            onClick={() => useTools.getState().refresh(true)}
            label={m.checkAgain}
            busyLabel={m.checking}
          />
        }
      />

      <ToolsIntro />
      <NodeNotice />
      <StoreDamageLine />
      {error && (
        <ErrorNotice raw={error.message} action={<ReportThis what="Looking for WireCat tools" error={error.message} />}>
          {m.inspectFailed}
        </ErrorNotice>
      )}
      {systemError && (
        <ErrorNotice raw={systemError} action={<ReportThis what="Checking Node.js and npm" error={systemError} />}>
          {m.systemFailed}
        </ErrorNotice>
      )}

      <div ref={storageSlot ? keepBelow : undefined} className="flex items-center gap-4">
        {storageSlot ? (
          <div className="flex min-h-[3.4rem] min-w-0 flex-1 flex-col justify-center">
            {compat === undefined ? (
              <Skeleton className="h-[3.4rem] w-full rounded-rack" label={m.checkingStorage} />
            ) : (
              <StorageSummary />
            )}
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <StorageSummary />
          </div>
        )}
        <InstallAll />
      </div>

      <OwnRemoved />
      {groups.map(
        ([group, list]) =>
          list.length > 0 && (
            <ToolGroup key={group} title={m.groups[group]}>
              {list.map((t) => (
                <ToolRow key={t.id} tool={t} />
              ))}
            </ToolGroup>
          ),
      )}
      <AddOwnTool />

      <OwnToolDialog />

      <UpgradeWarning />

      {latestUnknown && <p className="text-[0.9rem] text-ink-dim">{m.latestUnknown}</p>}
    </Page>
  )
}
