import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import {
  type Failure,
  funnelStopped,
  isLocalAddress,
  type Phase,
  type Tunnel,
  tunnelStopped,
  viaTailscale,
  wasStopped,
} from "@/domain/connect-guide"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { TunnelRoute } from "@/platform/cloudflare-schemas"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import type { FunnelState } from "@/platform/tailscale-schemas"
import { errorText } from "@/shared/errors"
import { AutoHeight } from "@/ui/AutoHeight"
import { BackButton } from "@/ui/BackButton"
import { focusInPlace } from "@/ui/motion"
import { useCloudflare } from "./CloudflareGuide"
import { AddressStep, DEFAULT_PORT } from "./ConnectAddress"
import { ChooseStep, ConnectStep } from "./ConnectApp"
import { Rail } from "./ConnectRail"
import { FunnelOff, ReachStep, TunnelOff } from "./ConnectReach"
import { StartStep } from "./ConnectStart"
import { TestStep } from "./ConnectTest"
import type { AppId } from "./connect-apps"
import { Progress } from "./connect-parts"
import { scenarioOf } from "./connect-scenario"
import { type ConnectStepId, currentStep, type ReachState, serving, testState } from "./connect-steps"
import { useFunnelHelper } from "./FunnelHelperGuide"
import { useKept } from "./kept"
import { connectMessages } from "./messages-connect"
import { useTailscale } from "./TailscaleGuide"

const POLL_MS = 4000

/**
 * From "I want ChatGPT to use my Telegram" to the first call arriving, on one surface that stays until the owner
 * closes it. Each step says what happens before anything runs; a step already done is a tick in the rail.
 */
export function ConnectGuide(props: {
  tool: CatalogTool
  server: McpServerStatus | null
  funnel: FunnelState | null
  /** The tool's paths on the Cloudflare tunnel the app runs, if any. */
  route: TunnelRoute | null
  reload(): Promise<void>
  settle(s: McpServerStatus): void
  onDone(): void
  /** Starts the guide again for another app. */
  onAgain(): void
}) {
  const { tool, server, funnel, route, reload, settle, onDone, onAgain } = props
  const m = useMessages(connectMessages)
  const scenario = useRef(scenarioOf(tool.id)).current
  // Kept outside the component, so leaving the page mid-guide and coming back lands on the same step.
  const kept = `connect:${tool.id}`
  const [app, setApp] = useKept<AppId | null>(kept, "app", scenario?.app ?? null)
  const [tunnel, setTunnel] = useKept<Tunnel>(kept, "tunnel", scenario?.tunnel ?? "tailscale")
  const [confirmed, setConfirmed] = useKept(kept, "confirmed", scenario?.confirmed ?? false)
  const [added, setAdded] = useKept(kept, "added", scenario?.added ?? false)
  const [reach, setReach] = useKept<ReachState>(kept, "reach", { state: "checking" })
  const [goOn, setGoOn] = useKept(kept, "goOn", false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [failure, setFailure] = useState<Failure | null>(null)
  const [approval, setApproval] = useState<string | null>(null)
  const [ownUrl, setOwnUrl] = useKept(kept, "ownUrl", "")
  const [port, setPort] = useKept(kept, "port", String(tool.mcpServer?.port ?? DEFAULT_PORT))
  const [since] = useKept(kept, "since", () => Date.now())
  // Mutable like refs, but outlive the component: a start already pressed is not pressed again on coming back.
  const [runs] = useKept(kept, "runs", () => ({ attempt: scenario?.confirmed ? 1 : 0, started: 0, offered: false }))

  // A tunnel on this computer only (http://127.0.0.1) has no public name to look up.
  const local = serving(server) && isLocalAddress(server)
  const reached = (reach.state === "live" || goOn || local) && serving(server)
  const progress = { app, addressReady: confirmed, server, reached, added }
  const current = currentStep(progress)
  const test = testState(server, since)
  const tailscale = useTailscale(current === "address" && viaTailscale(tunnel))
  const helper = useFunnelHelper(current === "address" && viaTailscale(tunnel))
  const [declined, setDeclined] = useKept(kept, "declined", false)

  // No Tailscale app here: WireCat's own connection needs no password, so the Tailscale choice opens on it.
  useEffect(() => {
    if (tunnel === "tailscale" && !declined && tailscale.status && !tailscale.status.installed) setTunnel("wirecat")
  }, [tunnel, declined, tailscale.status, setTunnel])
  const cloudflare = useCloudflare(current === "address" && tunnel === "cloudflare")

  // A tool that used the Cloudflare tunnel before starts on it again; the record arrives after the first render.
  useEffect(() => {
    if (runs.offered || !route) return
    runs.offered = true
    setTunnel("cloudflare")
  }, [route, runs, setTunnel])

  // An app that logs in while the owner still reads the instructions moves the guide on by itself.
  useEffect(() => {
    if (current === "connect" && test.state !== "waiting") setAdded(true)
  }, [current, test.state, setAdded])

  const watching = (current === "connect" || current === "test") && test.state !== "called"
  useEffect(() => {
    if (!watching) return
    const t = setInterval(reload, POLL_MS)
    return () => clearInterval(t)
  }, [watching, reload])

  // Strict mode runs effects twice; the server must start once per press.
  const start = useCallback(async () => {
    setFailure(null)
    setApproval(null)
    let at: Failure["at"] = "server"
    try {
      if (tunnel !== "own") {
        setPhase("tunnel")
        at = "tunnel"
        const address =
          tunnel === "tailscale"
            ? await platform.tailscaleFunnelOpen(tool.id, Number(port), setApproval)
            : tunnel === "wirecat"
              ? await platform.funnelHelperOpen(tool.id, Number(port))
              : await platform.cloudflareTunnelOpen(tool.id, Number(port))
        setPhase("server")
        at = "server"
        try {
          settle(await platform.mcpServerStart(tool.id, Number(port), address))
        } catch (e) {
          // Left on, the address would publish whatever takes the port next. Closing can cost the public name for a
          // few minutes (BUG-15); a retry waits for it rather than leave the port open.
          await (viaTailscale(tunnel)
            ? platform.tailscaleFunnelClose(tool.id)
            : platform.cloudflareTunnelClose(tool.id)
          ).catch(() => {})
          throw e
        }
      } else {
        setPhase("server")
        settle(await platform.mcpServerStart(tool.id, Number(port), ownUrl.trim().replace(/\/$/, "")))
      }
      setPhase("idle")
    } catch (e) {
      if (wasStopped(e)) {
        setPhase("idle")
        setConfirmed(false)
        return
      }
      setFailure({ at, message: errorText(e) })
      setPhase("failed")
    }
  }, [tunnel, tool.id, port, ownUrl, settle, setConfirmed])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `runs` is mutated like a ref; a press changes `current`
  useEffect(() => {
    if (current !== "start" || runs.started === runs.attempt) return
    runs.started = runs.attempt
    start()
  }, [current, start])

  const confirm = () => {
    runs.attempt++
    setConfirmed(true)
  }

  const retry = () => {
    runs.started = ++runs.attempt
    start()
  }

  const back = () => {
    setConfirmed(false)
    setPhase("idle")
    setFailure(null)
  }

  // Focus follows the step, so a keyboard or screen reader user lands on what changed. Not on the first render: the
  // owner's own click put focus where it is.
  const heading = useRef<HTMLHeadingElement>(null)
  const shown = useRef(current)
  useEffect(() => {
    if (shown.current === current) return
    shown.current = current
    focusInPlace(heading.current)
  }, [current])

  const starting = phase === "tunnel" || phase === "server"
  const backReason =
    current === "start"
      ? starting
        ? m.backWhy.starting
        : undefined
      : current === "address"
        ? undefined
        : m.backWhy.running
  const funnelOff = funnelStopped(tunnel, serving(server), funnel)
  const tunnelOff = tunnelStopped(server, serving(server), route)
  const name = app && app !== "other" ? m.apps[app].name : m.theApp

  const summary: Partial<Record<ConnectStepId, string | undefined>> = {
    choose: app ? m.apps[app].name : undefined,
    address: serving(server) ? new URL(server.connectorUrl).host : undefined,
    start: serving(server) && server.port ? m.rail.runningOn(server.port) : undefined,
    reach: reach.state === "live" ? m.rail.published : goOn ? m.rail.notChecked : undefined,
    connect: added ? m.rail.added : undefined,
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
      <Rail
        current={current}
        finished={current === "test" && test.state === "called"}
        summary={summary}
        onChoose={current !== "choose" ? () => setApp(null) : undefined}
      />
      <AutoHeight swap={current} className="min-w-0">
        <div
          key={current}
          className="step-in flex min-w-0 flex-col gap-3.5 rounded-[0.45rem] border border-line bg-app px-5 py-4"
          aria-live="polite"
        >
          <h5 ref={heading} tabIndex={-1} className="step-heading scroll-mt-3 text-[1.05rem] font-semibold text-ink">
            {current === "test" && test.state === "called"
              ? m.calledTitle(app ? m.apps[app].name : name, tool.name)
              : current === "connect" && app && app !== "other"
                ? m.addIn(name)
                : m.steps[current]}
          </h5>
          {current === "choose" && <ChooseStep tool={tool} onChoose={setApp} />}
          {current === "address" && (
            <AddressStep
              tool={tool}
              appName={name}
              tunnel={tunnel}
              setTunnel={setTunnel}
              tailscale={tailscale}
              helper={helper}
              onUseApp={() => {
                setDeclined(true)
                setTunnel("tailscale")
              }}
              cloudflare={cloudflare}
              ownUrl={ownUrl}
              setOwnUrl={setOwnUrl}
              port={port}
              setPort={setPort}
              onConfirm={confirm}
            />
          )}
          {current === "start" && (
            <StartStep
              tool={tool}
              tunnel={tunnel}
              phase={phase}
              failure={failure}
              approval={approval}
              onRetry={retry}
            />
          )}
          {current === "reach" && serving(server) && (
            <ReachStep
              tool={tool}
              app={app}
              server={server}
              reach={reach}
              setReach={setReach}
              onGoOn={() => setGoOn(true)}
            />
          )}
          {funnelOff && (current === "reach" || current === "connect" || current === "test") && (
            <FunnelOff
              tool={tool}
              port={server?.port ?? Number(port)}
              name={name}
              reload={reload}
              helper={funnel?.via === "wirecat"}
            />
          )}
          {tunnelOff && route && (current === "reach" || current === "connect" || current === "test") && (
            <TunnelOff tool={tool} port={route.port} name={name} reload={reload} />
          )}
          {/* The address check can pass in one look; its result stays in sight, so the step is not missed. */}
          {current === "connect" && serving(server) && !local && (
            <ul>
              <Progress state={reach.state === "live" ? "done" : "todo"}>
                {reach.state === "live"
                  ? m.reach.live(new URL(server.connectorUrl).host)
                  : m.reach.unchecked(new URL(server.connectorUrl).host)}
              </Progress>
            </ul>
          )}
          {current === "connect" && app && serving(server) && (
            <ConnectStep tool={tool} app={app} server={server} onAdded={() => setAdded(true)} />
          )}
          {current === "test" && app && serving(server) && (
            <TestStep
              tool={tool}
              app={app}
              server={server}
              test={test}
              since={since}
              quietFromStart={scenario?.quiet ?? false}
              onBack={() => setAdded(false)}
              onDone={onDone}
              onAgain={onAgain}
            />
          )}
          {current !== "choose" && current !== "test" && (
            <div className="flex border-line border-t pt-3">
              <BackButton size="sm" reason={backReason} onClick={current === "address" ? () => setApp(null) : back} />
            </div>
          )}
        </div>
      </AutoHeight>
    </div>
  )
}
