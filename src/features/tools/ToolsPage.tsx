import { useEffect } from "react"
import { tools } from "@/domain/catalog"
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
import { toolsMessages } from "./messages"
import { OwnRemoved } from "./OwnRemoved"
import { OwnToolDialog } from "./OwnToolDialog"
import { StorageSummary } from "./StorageFit"
import { StoreDamageLine } from "./StoreDamage"
import { ToolRow } from "./ToolRow"
import { ToolsIntro } from "./ToolsIntro"
import { UpgradeWarning } from "./UpgradeWarning"

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

  useEffect(() => {
    useTools.getState().refresh()
  }, [])

  return (
    <Page>
      <PageHeader
        title={m.title}
        status={progress}
        busy
        actions={
          <>
            <AddOwnTool />
            <RefreshButton
              tour="check-again"
              busy={refreshing}
              onClick={() => useTools.getState().refresh(true)}
              label={m.checkAgain}
              busyLabel={m.checking}
            />
          </>
        }
      />

      <ToolsIntro />
      <NodeNotice />
      <StoreDamageLine />
      {error && (
        <ErrorNotice action={<ReportThis what="Looking for WireCat tools" error={error.message} />}>
          {m.inspectFailed(error.message)}
        </ErrorNotice>
      )}
      {systemError && (
        <ErrorNotice action={<ReportThis what="Checking Node.js and npm" error={systemError} />}>
          {m.systemFailed(systemError)}
        </ErrorNotice>
      )}

      {storageSlot ? (
        <div ref={keepBelow} className="flex min-h-[3.4rem] flex-col justify-center">
          {compat === undefined ? (
            <Skeleton className="h-[3.4rem] w-full rounded-[0.2rem]" label={m.checkingStorage} />
          ) : (
            <StorageSummary />
          )}
        </div>
      ) : (
        <StorageSummary />
      )}

      <OwnRemoved />
      <ul aria-label={m.list} className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
        {tools.map((t) => (
          <ToolRow key={t.id} tool={t} />
        ))}
      </ul>

      <OwnToolDialog />

      <UpgradeWarning />

      {latestUnknown && <p className="text-[0.9rem] text-ink-dim">{m.latestUnknown}</p>}
    </Page>
  )
}
