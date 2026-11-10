import { Download } from "lucide-react"
import { type ReactNode, useEffect, useId } from "react"
import { requirements } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Readiness } from "@/platform/schemas"
import { OpenLink } from "@/shared/OpenLink"
import { ReportThis } from "@/shared/ReportThis"
import { useSystem } from "@/shared/system-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useCreep } from "@/ui/motion"
import { ProgressBar } from "@/ui/ProgressBar"
import { Stepper, type StepState } from "@/ui/Stepper"
import { ManagedNode } from "./ManagedNode"
import { systemMessages } from "./messages"
import { type NodeStep, useNode } from "./node-store"

const STEPS: readonly NodeStep[] = ["check", "download", "verify", "unpack", "path"]

const NODEJS_ORG = "nodejs.org"
const PATH_PARTS = 2

/** Asks for Node.js when the tools cannot be installed, and offers to set it up in the user's own folder. */
export function NodeNotice() {
  const r = useSystem((s) => s.readiness)
  const path = useNode((s) => s.path)
  const m = useMessages(systemMessages)
  const managedActive = r?.managed?.active ?? false

  useEffect(() => {
    if (managedActive) useNode.getState().loadPath()
  }, [managedActive])

  // Folded in and out rather than mounted, so the notice never vanishes the moment Node.js is ready.
  let notice: ReactNode = null
  if (r && managedActive) {
    // Once it is on PATH there is nothing left to ask; the readiness strip still opens it.
    if (path && !path.added) {
      notice = (
        <section aria-label={m.nodeForTools} className="rounded-[0.2rem] border border-line-strong bg-app px-5 py-4">
          <p className="font-semibold">{m.managedTitle(r.managed?.version ?? "")}</p>
          <p className="mt-0.5 max-w-[70ch] text-[0.95rem] text-ink-soft">{m.managedBody}</p>
          <div className="mt-4">
            <ManagedNode compact />
          </div>
        </section>
      )
    }
  } else if (r && !(r.node.ok && r.npmPrefixWritable !== false)) notice = <NeedsNode r={r} />
  return <Collapse open={notice !== null}>{notice}</Collapse>
}

function NeedsNode({ r }: { r: Readiness }) {
  const offer = useNode((s) => s.offer)
  const offerError = useNode((s) => s.offerError)
  const running = useNode((s) => s.running)
  const failure = useNode((s) => s.failure)
  const manual = useNode((s) => s.myself)
  const manualId = useId()
  const m = useMessages(systemMessages)

  useEffect(() => {
    useNode.getState().loadOffer()
  }, [])

  const admin = r.node.ok
  const title = admin ? m.adminTitle : !r.node.version ? m.missingTitle : m.oldTitle(r.node.version)
  const body = admin ? m.adminBody(r.npmPrefix ?? "") : m.needBody(requirements.nodeLabel)

  return (
    <section
      data-node-notice
      tabIndex={-1}
      aria-label={m.nodeForTools}
      className="flex flex-col gap-4 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-5 py-4"
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 max-w-[70ch] text-[0.95rem] text-ink-soft">{body}</p>
      </div>

      {running || (failure && failure.reason !== "cancelled") ? (
        <Progress />
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="primary"
            onClick={() => useNode.getState().setup()}
            icon={<Download className="size-4" aria-hidden />}
          >
            {m.setUp}
          </Button>
          <Button aria-expanded={manual} aria-controls={manualId} onClick={() => useNode.getState().setMyself(!manual)}>
            {m.installMyself}
          </Button>
          <p className="min-w-0 text-[0.875rem] text-ink-soft">
            {offer
              ? m.offer(
                  <>
                    <span className="selectable font-mono tabular-nums text-ink">{`Node.js ${offer.version}`}</span>
                    {offer.bytes ? <span className="font-mono tabular-nums"> · {formatBytes(offer.bytes)}</span> : null}
                  </>,
                  NODEJS_ORG,
                )
              : offerError
                ? m.offerUnknown(NODEJS_ORG)
                : m.asking(NODEJS_ORG)}
          </p>
        </div>
      )}

      <Collapse open={manual && !running} id={manualId} className="flex flex-col gap-2 border-line border-t pt-4">
        <Manual admin={admin} />
      </Collapse>
    </section>
  )
}

function Progress() {
  const step = useNode((s) => s.step)
  const running = useNode((s) => s.running)
  const failure = useNode((s) => s.failure)
  const received = useNode((s) => s.received)
  const total = useNode((s) => s.total)
  const offer = useNode((s) => s.offer)
  const pathPart = useNode((s) => s.pathPart)
  const pathFile = useNode((s) => s.pathFile)
  const m = useMessages(systemMessages)

  // Two real signals split the PATH step: Rust has written the line, then the computer is checked again. Neither
  // reports a share, so the bar eases through each part and the next signal moves it on.
  const part = step === "path" && running && !failure ? (pathPart ?? "write") : null
  const partAt = part === "check" ? 1 : 0
  const crept = useCreep(part, part === "check" ? 2500 : 800)
  const pathPct = part ? ((partAt + crept) / PATH_PARTS) * 100 : null

  const current = step ? STEPS.indexOf(step) : -1
  const steps = STEPS.map((id, i) => {
    let state: StepState = "todo"
    if (i < current) state = "done"
    else if (i === current) state = failure ? "failed" : "active"
    return { label: m.steps[id], state }
  })
  const pct = total ? Math.min(100, Math.round((received / total) * 100)) : null
  const counted = (step === "download" || step === "unpack") && !failure
  const barLabel = step === "download" ? m.downloading : step === "unpack" ? m.unpacking : step ? m.steps[step] : ""

  return (
    <div className="flex flex-col gap-4 rounded-[0.45rem] border border-line bg-app px-5 py-4">
      <Stepper steps={steps} />
      {/* One bar for the whole setup, so the box keeps its height from step to step; checks and PATH say no share. */}
      {running && !failure && (
        <div className="flex flex-col gap-2">
          <div className="flex min-h-[1.4rem] items-center gap-4">
            <ProgressBar
              label={barLabel}
              value={counted ? (pct ?? 0) : pathPct}
              valueText={part ? m.pathStep(partAt + 1, PATH_PARTS) : undefined}
              busy={part !== null}
              className="flex-1"
            />
            {part && (
              <span className="shrink-0 font-mono text-[0.875rem] tabular-nums text-ink-soft">
                {m.pathStep(partAt + 1, PATH_PARTS)}
              </span>
            )}
            {counted && (
              <span className="shrink-0 font-mono text-[0.875rem] tabular-nums text-ink-soft">
                {step === "unpack" && pct !== null
                  ? m.ofArchive(pct)
                  : total
                    ? m.ofTotal(formatBytes(received), formatBytes(total))
                    : formatBytes(received)}
              </span>
            )}
          </div>
          <p aria-live="polite" className="text-[0.95rem] text-ink-soft">
            {step === "check" && m.asking(NODEJS_ORG)}
            {step === "download" && m.downloading}
            {step === "verify" && m.verifying(NODEJS_ORG)}
            {step === "unpack" && (offer?.dir ? m.unpackInto(offer.dir) : m.unpackHome)}
            {part === "write" && m.pathing}
            {part === "check" && m.pathChecking(pathFile)}
          </p>
        </div>
      )}
      {failure && (
        <ErrorNotice
          inline
          className="text-[0.95rem]"
          detail={failure.hint}
          action={
            <ReportThis what="Setting up Node.js" error={[failure.message, failure.hint].filter(Boolean).join(" ")} />
          }
        >
          <span className="font-medium">{failure.message}</span>
        </ErrorNotice>
      )}
      <div className="flex justify-end gap-2">
        {running ? (
          // Node.js is in place by the PATH step, and the setup only waits for the computer to be checked again.
          <Button size="sm" disabled={step === "path"} onClick={() => useNode.getState().cancel()}>
            {m.cancel}
          </Button>
        ) : (
          <Button size="sm" onClick={() => useNode.getState().setup()}>
            {m.tryAgain}
          </Button>
        )}
      </div>
    </div>
  )
}

function Manual({ admin }: { admin: boolean }) {
  const m = useMessages(systemMessages)
  if (admin) {
    return (
      <>
        <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">
          {m.adminManual(<code className="font-mono">bin</code>)}
        </p>
        <CopyField value="npm config set prefix ~/.npm-global" label={m.copyCommand} />
      </>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">{m.install[platform.os](requirements.nodeLabel)}</p>
      <OpenLink url={requirements.nodeDownload}>{NODEJS_ORG}</OpenLink>
    </div>
  )
}
