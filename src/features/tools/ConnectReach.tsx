import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { errorMessage, isFunnelHost, publishWait, reachLamp } from "@/domain/connect-guide"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ProgressBar } from "@/ui/ProgressBar"
import type { AppId } from "./connect-apps"
import { Note, Para, Progress } from "./connect-parts"
import { type ReachState, reachOf } from "./connect-steps"
import { connectMessages } from "./messages-connect"
import { helperMessages } from "./messages-helper"

const RECHECK_MS = 15_000

export function ReachStep(props: {
  tool: CatalogTool
  app: AppId | null
  server: McpServerStatus & { connectorUrl: string }
  reach: ReachState
  setReach(r: ReachState): void
  onGoOn(): void
}) {
  const { tool, app, server, reach, setReach, onGoOn } = props
  const all = useMessages(connectMessages)
  const m = all.reach
  const name = app && app !== "other" ? all.apps[app].name : all.theApp
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const firstMissing = useRef<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const host = new URL(server.connectorUrl).host
  // Tailscale publishes a Funnel name itself, slowly; on a tunnel of the owner's the record already exists.
  const funnel = isFunnelHost(host)

  const check = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const next = reachOf(await platform.mcpServerPublic(tool.id))
      if (next.state === "publishing") firstMissing.current ??= Date.now()
      setReach(next)
    } catch (e) {
      setError(errorMessage(e))
    }
    setChecking(false)
  }, [tool.id, setReach])

  useEffect(() => {
    check()
  }, [check])

  // While Tailscale publishes the name, look again on its own and show how long it has been.
  useEffect(() => {
    if (reach.state !== "publishing") return
    const again = setInterval(check, RECHECK_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(again)
      clearInterval(clock)
    }
  }, [reach.state, check])

  const waited = firstMissing.current === null ? 0 : now - firstMissing.current
  const { share, minutes } = publishWait(waited)

  return (
    <>
      <Para>
        {m.intro(
          app ? all.apps[app].name : name,
          tool.bin,
          <span className="selectable font-mono text-ink">{host}</span>,
        )}
      </Para>
      <ul className="flex flex-col gap-2">
        <Progress state={reachLamp(reach, checking)}>
          {reach.state === "publishing"
            ? funnel
              ? m.publishingFunnel
              : m.publishingDns
            : reach.state === "unknown"
              ? m.dnsUnknown
              : reach.state === "checking"
                ? m.asking
                : m.published}
        </Progress>
      </ul>
      {reach.state === "publishing" && (
        <div className="flex max-w-[34rem] flex-col gap-1.5">
          <ProgressBar
            label={m.barLabel}
            value={share * 10}
            max={10}
            valueText={m.barValue(minutes)}
            pace="steady"
            minShare={2}
          />
          <Note>{m.wait(funnel, minutes, name)}</Note>
          {share >= 1 && <p className="text-[0.9rem] text-warn-ink">{funnel ? m.slowFunnel : m.slowDns(host)}</p>}
        </div>
      )}
      {reach.state === "live" && !reach.tested && <Note>{m.selfUnreachable(name)}</Note>}
      {reach.state === "wrong" && (
        <>
          <ErrorNotice inline>
            {funnel ? m.wrongFunnel(tool.bin, reach.status) : m.wrongTunnel(tool.bin, reach.status, name)}
          </ErrorNotice>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={checking}>
              {checking ? m.checking : m.again}
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoOn}>
              {m.goOn}
            </Button>
          </div>
        </>
      )}
      {reach.state === "unknown" && (
        <>
          <Para>{m.unknownHelp(name)}</Para>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={onGoOn}>
              {m.goOnUnchecked}
            </Button>
            <Button size="sm" variant="ghost" onClick={check} disabled={checking}>
              {checking ? m.checking : m.again}
            </Button>
          </div>
        </>
      )}
      {error && (
        <>
          <ErrorNotice inline>{error}</ErrorNotice>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={checking}>
              {checking ? m.checking : m.again}
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoOn}>
              {m.goOnUnchecked}
            </Button>
          </div>
        </>
      )}
    </>
  )
}

/** `helper`: the server's address is on WireCat's own Tailscale connection, which stopped with the computer. */
export function FunnelOff(props: {
  tool: CatalogTool
  port: number
  name: string
  reload(): Promise<void>
  helper: boolean
}) {
  const { tool, port, name, reload, helper } = props
  const m = useMessages(connectMessages).off
  const hm = useMessages(helperMessages)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      if (helper) {
        await platform.funnelHelperStart(() => {})
        await platform.funnelHelperOpen(tool.id, port)
      } else {
        await platform.tailscaleFunnelOpen(tool.id, port, () => {})
      }
      await reload()
    } catch (e) {
      setError(errorMessage(e))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-2 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3.5 py-2.5">
      <p className="text-[0.9rem] text-warn-ink">{helper ? hm.off(name) : m.funnel(name)}</p>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      <div>
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy ? (helper ? hm.turningOn : m.turningOn) : helper ? hm.turnOn : m.turnOn}
        </Button>
      </div>
    </div>
  )
}

/** cloudflared stops with the computer; the tools' servers too, but a server started again finds its tunnel off. */
export function TunnelOff(props: { tool: CatalogTool; port: number; name: string; reload(): Promise<void> }) {
  const { tool, port, name, reload } = props
  const m = useMessages(connectMessages).off
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.cloudflareTunnelOpen(tool.id, port)
      await reload()
    } catch (e) {
      setError(errorMessage(e))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-2 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3.5 py-2.5">
      <p className="text-[0.9rem] text-warn-ink">{m.tunnel(name)}</p>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      <div>
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy ? m.starting : m.start}
        </Button>
      </div>
    </div>
  )
}
