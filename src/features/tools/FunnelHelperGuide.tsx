import { useEffect, useRef, useState } from "react"
import { FUNNEL_HELPER } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { FunnelHelperStatus } from "@/platform/tailscale-schemas"
import { errorText } from "@/shared/errors"
import { OpenLink } from "@/shared/OpenLink"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { LinkButton } from "@/ui/LinkButton"
import { type Helper, useFunnelHelper } from "./api"
import { InstallProgress } from "./InstallProgress"
import { helperMessages } from "./messages-helper"

export const helperReady = (s: FunnelHelperStatus | null) => s?.installed === true && s.state === "running"

/**
 * Two steps on the guide's own surface: install the helper like a tool (npm, with the same provenance check), then
 * start it, which opens each Tailscale page it needs once. Its login stays on this computer, so it is asked once.
 */
export function FunnelHelperGuide({ helper, onUseApp }: { helper: Helper; onUseApp(): void }) {
  const m = useMessages(helperMessages)
  const { status, check, setStatus } = helper
  const session = useTools((s) => s.sessions[FUNNEL_HELPER])
  const install = useTools((s) => s.install)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const installing = session !== undefined && session.operation === "install" && !session.outcome
  const outcome = session?.outcome
  useEffect(() => {
    if (outcome?.event === "done") check()
  }, [outcome, check])

  useFunnelHelper(busy, 2000)

  // Leaving the guide while it waits for the browser ends the wait; whatever was done there stays done.
  const live = useRef(false)
  live.current = busy
  useEffect(
    () => () => {
      if (live.current) platform.tailscaleStop()
    },
    [],
  )

  const connect = async () => {
    setBusy(true)
    setError(null)
    setPage(null)
    try {
      setStatus(await platform.funnelHelperStart(setPage))
    } catch (e) {
      if (errorText(e) !== "Stopped.") setError(errorText(e))
      check()
    }
    setBusy(false)
  }

  const installed = status?.installed === true
  const running = helperReady(status)
  const waiting = busy && status && status.state !== "running" ? status.state : null
  const host = status?.url ? new URL(status.url).host : null

  return (
    <div className="flex flex-col gap-3.5">
      <p className="max-w-[62ch]">{m.intro}</p>
      <p className="max-w-[62ch] text-[0.9rem] text-ink-dim">{m.privacy}</p>
      <ol className="flex flex-col gap-3">
        <li className="flex flex-col gap-2">
          <span className="flex items-center gap-2.5">
            <Lamp tone={installed ? "ok" : installing ? "busy" : "idle"} size="sm" label={m.steps.install} />
            <span className="text-[0.95rem] font-medium text-ink">{m.steps.install}</span>
          </span>
          {!installed && !installing && (
            <div className="pl-6">
              <Button size="sm" variant="primary" onClick={() => install(FUNNEL_HELPER)}>
                {m.install}
              </Button>
            </div>
          )}
          {installing && session && (
            <div className="pl-6">
              <InstallProgress session={session} compact />
            </div>
          )}
          {!installed && outcome?.event === "failed" && (
            <div className="pl-6">
              <ErrorNotice inline raw={outcome.message}>
                {m.installFailed}
              </ErrorNotice>
            </div>
          )}
        </li>
        <li className="flex flex-col gap-2">
          <span className="flex items-center gap-2.5">
            <Lamp tone={running ? "ok" : busy ? "busy" : "idle"} size="sm" label={m.steps.signin} />
            <span className={installed ? "text-[0.95rem] font-medium text-ink" : "text-[0.95rem] text-ink-dim"}>
              {m.steps.signin}
            </span>
          </span>
          {installed && !running && !busy && (
            <div className="pl-6">
              <Button size="sm" variant="primary" onClick={connect}>
                {m.connect}
              </Button>
            </div>
          )}
          {busy && (
            <div className="flex flex-col gap-2 pl-6">
              <p className="text-[0.92rem] text-ink" aria-live="polite">
                {waiting && waiting !== "stopped" && waiting !== "error" ? m.waiting[waiting] : m.connecting}
              </p>
              <div className="flex flex-wrap gap-2">
                {page && <OpenLink url={page}>{m.openAgain}</OpenLink>}
                <Button size="sm" variant="ghost" onClick={() => platform.tailscaleStop()}>
                  {m.stop}
                </Button>
              </div>
            </div>
          )}
          {running && host && (
            <p className="pl-6 text-[0.92rem] text-ink">
              {m.connected(<span className="selectable font-mono">{host}</span>)}
            </p>
          )}
          {error && (
            <div className="pl-6">
              <ErrorNotice inline>{error}</ErrorNotice>
            </div>
          )}
        </li>
      </ol>
      <div>
        <LinkButton className="text-[0.9rem]" onClick={onUseApp}>
          {m.useApp}
        </LinkButton>
      </div>
    </div>
  )
}
