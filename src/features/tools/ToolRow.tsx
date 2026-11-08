import { LoaderCircle } from "lucide-react"
import { useRef } from "react"
import { type CatalogTool, findTool, isCommunity, isOwn, maker, ownerId } from "@/domain/catalog"
import { listBlocksInstalls } from "@/domain/community-list"
import { fitSeverity } from "@/domain/compat"
import { type ToolStatus, toolStatus } from "@/domain/status"
import { useMessages } from "@/i18n"
import { useSystem } from "@/shared/system-store"
import { ToolIcon } from "@/shared/ToolIcon"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { focusInPlace, holdInPlace } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { activityOf } from "./connect-steps"
import { InstallPanel } from "./InstallPanel"
import { InstallLine } from "./InstallProgress"
import { type ToolsText, toolsMessages } from "./messages"
import { ownMessages } from "./messages-own"
import { registryMessages } from "./messages-registry"
import { useRegistry } from "./registry-store"
import { fitLabel, fitLine, useLatestKnown } from "./StorageFit"
import { RowSyncButton, RowSyncLine, useRowSync } from "./Sync"
import { ToolDetails } from "./ToolDetails"
import { toolText } from "./tool-text"
import { useFits } from "./useFits"
import { useMcpActivity } from "./useMcpActivity"

const lampTone: Record<ToolStatus["kind"], LampTone> = {
  checking: "idle",
  missing: "idle",
  working: "busy",
  broken: "bad",
  outdated: "warn",
  ready: "ok",
}

const lampLabel = (s: ToolStatus, m: ToolsText["row"]["status"]) =>
  ({
    checking: m.checking,
    missing: m.missing,
    working: s.kind === "working" && s.operation === "uninstall" ? m.uninstalling : m.installing,
    broken: m.broken,
    outdated: m.outdated,
    ready: s.kind === "ready" && s.checkingUpdates ? m.readyChecking : m.ready,
  })[s.kind]

export function ToolRow({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id])
  const latest = useTools((s) => (s.latest ? (s.latest[tool.id] ?? null) : undefined))
  const session = useTools((s) => s.sessions[ownerId(tool.id)])
  const expanded = useTools((s) => s.expanded === tool.id)
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const fit = useFits()?.all[ownerId(tool.id)]
  const { install, cancel } = useTools.getState()
  const t = useMessages(toolsMessages)
  const om = useMessages(ownMessages)
  const rm = useMessages(registryMessages)
  const blocked = useRegistry((s) => isCommunity(tool) && !isOwn(tool) && listBlocksInstalls(s.status))
  const m = t.row
  const header = useRef<HTMLDivElement>(null)
  const showInstallPanel = Boolean(session) && !session?.closed?.includes(tool.id)
  const open = expanded || showInstallPanel
  // A finished install's panel holds the row open on its own, so closing the row also puts that result away.
  const toggle = (id: string) => {
    if (header.current) holdInPlace(header.current)
    const tools = useTools.getState()
    if (showInstallPanel && session?.outcome) {
      tools.dismiss(id)
      if (expanded) tools.toggle(id)
      return
    }
    tools.toggle(id)
  }

  const status = toolStatus(installs, latest, session)
  const installed = status.kind === "ready" || status.kind === "outdated"
  const severity = installed ? fitSeverity(fit) : null
  const latestKnown = useLatestKnown()
  const canUpdate = status.kind === "outdated" ? true : latestKnown ? false : null
  const storageLine = installed ? fitLine(fit, ownerId(tool.id), canUpdate, t.storage) : null
  const storageLabel = installed ? fitLabel(fit, t.storage) : null
  const lamp = lampLabel(status, m.status)
  const panelId = `tool-panel-${tool.id}`
  const app = useMcpActivity(tool, installed, expanded)
  const sync = useRowSync(tool, installed)
  // The same live progress the setup shows, so an install started there is visible here with the panel shut.
  const installing =
    session && !session.outcome && session.operation === "install" && session.step !== "preflight" ? session : null
  const lineKind = installing
    ? "install"
    : blocked
      ? "blocked"
      : storageLine
        ? "storage"
        : sync && (sync.run || !app)
          ? "sync"
          : app
            ? "app"
            : isCommunity(tool) && !installs?.length
              ? "trust"
              : "tagline"

  return (
    <li data-tour="tool" className="border-line border-b last:border-b-0">
      <div
        ref={header}
        className="grid min-h-[4.5rem] grid-cols-[1.2rem_1.8rem_minmax(0,1fr)_2.25rem_6.6rem_8.6rem] items-center gap-x-[0.9rem] xl:grid-cols-[1.6rem_2.2rem_minmax(0,1fr)_2.25rem_7.8rem_9.6rem] xl:gap-x-[1.2rem] px-[1.3rem]"
      >
        <Lamp
          tone={severity ?? lampTone[status.kind]}
          label={storageLabel ? m.withStorage(lamp, storageLabel) : lamp}
        />
        <ToolIcon id={tool.id} className="size-[1.6rem] text-ink xl:size-[1.75rem]" />
        <TextButton
          as="div"
          onClick={() => toggle(tool.id)}
          aria-expanded={open}
          aria-controls={panelId}
          className="group min-w-0 py-3 text-left"
        >
          <h3 className="flex items-baseline gap-[0.6rem] text-[1.08rem] font-semibold leading-tight group-hover:text-brand">
            {tool.name}
            <span className="font-mono text-[0.95rem] font-normal text-ink-soft">{tool.bin}</span>
            {tool.partOf && <Pill>{m.partOf(findTool(tool.partOf)?.name ?? tool.partOf)}</Pill>}
            {isCommunity(tool) && <Pill>{isOwn(tool) ? om.notChecked : m.community}</Pill>}
            {(installs?.length ?? 0) > 1 && <Pill tone="warn">{m.copies(installs?.length ?? 0)}</Pill>}
            <ExpandChevron open={open} className="self-center group-hover:text-brand" />
          </h3>
          {/* The line under the name changes with what the tool does; each new line fades in over the last. */}
          <Crossfade swap={lineKind}>
            {installing ? (
              <div className="mt-1 max-w-[28rem]">
                <InstallLine session={installing} name={tool.name} flat />
              </div>
            ) : blocked ? (
              <p className="mt-1 line-clamp-2 text-[0.95rem] text-warn-ink">{rm.row}</p>
            ) : storageLine ? (
              <p
                title={storageLine}
                className={cx("mt-1 truncate text-[0.95rem]", severity === "bad" ? "text-bad" : "text-warn-ink")}
              >
                {storageLine}
              </p>
            ) : sync && (sync.run || !app) ? (
              <p className="mt-1 flex text-[0.95rem] text-ink-soft">
                <RowSyncLine entry={tool} info={sync} />
              </p>
            ) : app ? (
              <p className="mt-1 flex items-center gap-2 text-[0.95rem] text-ink-soft tabular-nums">
                <span aria-hidden className="size-[0.45rem] shrink-0 rounded-full bg-ok" />
                <span className="truncate">
                  {app.claimedName ?? m.browserApp} · {activityOf(app)}
                </span>
              </p>
            ) : isCommunity(tool) && !installs?.length ? (
              <p className="mt-1 line-clamp-2 text-body text-ink-soft">
                {isOwn(tool) ? om.trust(maker(tool)) : m.trust(maker(tool))}
              </p>
            ) : (
              <p className="mt-1 truncate text-body text-ink-soft">{toolText(t, tool).tagline}</p>
            )}
          </Crossfade>
        </TextButton>
        {sync ? <RowSyncButton entry={tool} info={sync} /> : <span />}
        <Version status={status} installed={installs?.[0]?.version ?? null} m={m} />
        <div data-tour="tool-action" className="flex justify-end">
          {/* Install → Cancel → Manage: one button fades into the next, and keyboard focus moves with it. */}
          <Crossfade swap={status.kind === "checking" ? "checking" : actionKind(status)} align="end" className="w-full">
            <Action
              status={status}
              expanded={open}
              needsNode={!nodeReady}
              nodeFirst={m.nodeFirst}
              controls={panelId}
              onInstall={() =>
                !nodeReady
                  ? focusInPlace(document.querySelector<HTMLElement>("[data-node-notice]"))
                  : install(tool.id, { check: true })
              }
              onToggle={() => toggle(tool.id)}
              onCancel={() => cancel(tool.id)}
              m={m}
            />
          </Crossfade>
        </div>
      </div>
      <Collapse id={panelId} open={open}>
        {/* An install that ends becomes the tool's details: the height follows, and the two views cross-fade. */}
        <AutoHeight swap={showInstallPanel}>
          <Crossfade swap={showInstallPanel ? "install" : "details"}>
            {showInstallPanel ? <InstallPanel tool={tool} /> : <ToolDetails tool={tool} />}
          </Crossfade>
        </AutoHeight>
      </Collapse>
    </li>
  )
}

// While a tool installs, the column keeps saying what is on the machine now; the panel below shows the progress.
function Version(props: { status: ToolStatus; installed: string | null; m: ToolsText["row"] }) {
  const { status, installed, m } = props
  if (status.kind === "checking") return <Skeleton className="h-4 w-16" label={m.status.checking} />
  const text = status.kind === "broken" ? m.doesNotStart : "version" in status ? status.version : installed
  return (
    <span
      className={cx(
        // A version never wraps; "Not installed" may, since the column is sized for versions, not for every language.
        "font-mono text-[1.02rem] leading-tight tabular-nums",
        text && status.kind !== "broken" && "whitespace-nowrap",
        text ? "text-ink" : "text-ink-soft",
        status.kind === "broken" && "text-bad",
      )}
    >
      {text ?? m.notInstalled}
      {status.kind === "ready" && status.checkingUpdates && (
        <LoaderCircle className="ml-1.5 inline size-3.5 animate-spin align-[-0.15em] text-ink-dim" aria-hidden />
      )}
    </span>
  )
}

/** Which button the row shows; a new kind is a new button, which fades in over the old one. */
const actionKind = (status: ToolStatus) =>
  status.kind === "working"
    ? "cancel"
    : status.kind === "missing" || status.kind === "outdated"
      ? status.kind
      : status.kind === "broken"
        ? "fix"
        : "manage"

type ActionProps = {
  status: ToolStatus
  expanded: boolean
  /** Install still runs nothing then: the click takes the owner to the Node.js notice that says what to do. */
  needsNode: boolean
  nodeFirst: string
  controls: string
  onInstall: () => void
  onToggle: () => void
  onCancel: () => void
  m: ToolsText["row"]
}

function Action(props: ActionProps) {
  const { status, expanded, needsNode, nodeFirst, controls, onInstall, onToggle, onCancel, m } = props
  // The column's full width: "Update to 0.95.0" is wider than the other buttons.
  if (status.kind === "checking") return <Skeleton className="h-[2.4rem] w-full" />
  if (status.kind === "working") {
    return (
      <Button variant="secondary" onClick={onCancel} className="min-w-[7.6rem]">
        {m.cancel}
      </Button>
    )
  }
  if (status.kind === "missing" || status.kind === "outdated") {
    const update = status.kind === "outdated"
    return (
      <Button variant="primary" onClick={onInstall} title={needsNode ? nodeFirst : undefined}>
        {update ? m.updateTo(status.latest) : m.install}
      </Button>
    )
  }
  return (
    <Button
      variant={status.kind === "broken" ? "danger" : "secondary"}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="min-w-[7.6rem] pr-[0.8rem]"
    >
      {status.kind === "broken" ? m.fix : m.manage}
      <ExpandChevron open={expanded} className="text-current opacity-70" />
    </Button>
  )
}
