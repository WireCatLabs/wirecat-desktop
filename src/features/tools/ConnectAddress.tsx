import { useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { choiceOf, type Tunnel } from "@/domain/connect-guide"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Radio } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import type { Helper, useCloudflare, useTailscale } from "./api"
import { CloudflareGuide } from "./CloudflareGuide"
import { cloudflareSteps } from "./cloudflare-steps"
import { Note, Para } from "./connect-parts"
import { FunnelHelperGuide, helperReady } from "./FunnelHelperGuide"
import { formProblem } from "./McpServerDialogs"
import { connectMessages } from "./messages-connect"
import { helperMessages } from "./messages-helper"
import { tunnelMessages } from "./messages-tunnel"
import { TailscaleGuide } from "./TailscaleGuide"
import { addressOf, stepsOf } from "./tailscale-steps"

export const DEFAULT_PORT = 8765

const exampleUrl = (tool: string) => `https://laptop.tail1234.ts.net/${tool}`

const inputClass =
  "h-8 rounded-control border border-line-strong bg-app px-2.5 font-mono text-[0.85rem] text-ink placeholder:font-sans placeholder:text-ink-dim"

export function AddressStep(props: {
  tool: CatalogTool
  appName: string
  tunnel: Tunnel
  setTunnel(t: Tunnel): void
  tailscale: ReturnType<typeof useTailscale>
  helper: Helper
  onUseApp(): void
  cloudflare: ReturnType<typeof useCloudflare>
  ownUrl: string
  setOwnUrl(u: string): void
  port: string
  setPort(p: string): void
  onConfirm(): void
}) {
  const { tool, appName, tunnel, setTunnel, tailscale, helper, onUseApp, cloudflare } = props
  const { ownUrl, setOwnUrl, port, setPort, onConfirm } = props
  const m = useMessages(connectMessages).address
  const hm = useMessages(helperMessages)
  const helperUrl = helper.status?.url && `${helper.status.url}/${tool.id}/mcp`
  const tm = useMessages(tunnelMessages).tailscale
  const id = useId()
  const [problem, setProblem] = useState<"url" | "port" | null>(null)
  const status = tailscale.status
  const steps = status ? stepsOf(status) : []
  const ready = steps.length > 0 && steps.every((s) => s.done)
  const full = steps.find((s) => s.id === "connect" && !s.done && s.missing !== "blocked")
  const address = status ? addressOf(status, tool.id) : null
  const tailscaleUrl = address && `${address}/mcp`
  const cf = cloudflare.status
  const cfReady = cf !== null && cloudflareSteps(cf).every((s) => s.done)
  const cfUrl = cf?.hostname && `https://${cf.hostname}/${tool.id}/mcp`

  const submit = () => {
    const wrong = formProblem(tunnel === "own" ? ownUrl.trim() : "https://x.example.com", port)
    if (wrong) return setProblem(wrong)
    setProblem(null)
    onConfirm()
  }

  return (
    <>
      <Para>{m.intro(tool.name, appName)}</Para>
      <TunnelChoice tunnel={tunnel} setTunnel={setTunnel} />
      {/* The choice opens its own part in place; the others fold away, so nothing above it moves. */}
      <div>
        <Collapse open={tunnel === "cloudflare"} className="flex flex-col gap-3.5">
          <CloudflareGuide cloudflare={cloudflare} />
          {cfReady && cf.hostname && (
            <div className="flex flex-col gap-2.5 rounded-inset bg-app-2 px-4 py-3">
              <p className="text-[0.92rem] text-ink">
                {m.willBe(<span className="selectable font-mono">{cfUrl}</span>)}
              </p>
              <Note>{m.cloudflareNext(tool.bin)}</Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={submit}>
                  {m.start}
                </Button>
              </div>
            </div>
          )}
        </Collapse>
        <Collapse open={tunnel === "wirecat"} className="flex flex-col gap-3.5">
          <FunnelHelperGuide helper={helper} onUseApp={onUseApp} />
          {helperReady(helper.status) && (
            <div className="flex flex-col gap-2.5 rounded-inset bg-app-2 px-4 py-3">
              <p className="text-[0.92rem] text-ink">
                {m.willBe(<span className="selectable font-mono">{helperUrl}</span>)}
              </p>
              <Note>{hm.next(tool.bin)}</Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={submit}>
                  {m.start}
                </Button>
              </div>
            </div>
          )}
        </Collapse>
        <Collapse open={tunnel === "tailscale"} className="flex flex-col gap-3.5">
          {status && !status.installed && (
            <div>
              <Button size="sm" onClick={() => setTunnel("wirecat")}>
                {hm.offer}
              </Button>
            </div>
          )}
          <TailscaleGuide tailscale={tailscale} />
          {full?.missing && <p className="text-[0.88rem] text-warn-ink">{tm.missing[full.missing]}</p>}
          {ready && (
            <div className="flex flex-col gap-2.5 rounded-inset bg-app-2 px-4 py-3">
              <p className="text-[0.92rem] text-ink">
                {tailscaleUrl
                  ? m.willBe(<span className="selectable font-mono">{tailscaleUrl}</span>)
                  : m.onTailscaleName}
              </p>
              <Note>{m.tailscaleNext(tool.bin)}</Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={submit}>
                  {m.start}
                </Button>
              </div>
            </div>
          )}
        </Collapse>
        <Collapse open={tunnel === "own"} className="flex flex-col gap-3.5">
          <Para>{m.ownIntro(port || String(DEFAULT_PORT))}</Para>
          <label className="flex flex-col gap-1" htmlFor={`${id}-url`}>
            <span className="text-[0.9rem] font-medium text-ink-dim">{m.ownLabel}</span>
            <input
              id={`${id}-url`}
              className={`${inputClass} w-full max-w-[32rem]`}
              value={ownUrl}
              onChange={(e) => setOwnUrl(e.target.value)}
              placeholder={exampleUrl(tool.id)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Note>{m.ownPaths(tool.id)}</Note>
          <PortField id={`${id}-own-port`} port={port} setPort={setPort} />
          <div>
            <Button size="sm" variant="primary" onClick={submit}>
              {m.start}
            </Button>
          </div>
        </Collapse>
      </div>
      {problem && <ErrorNotice inline>{m.problem[problem]}</ErrorNotice>}
      {tunnel !== "own" && (
        <Disclosure summary={m.otherPort}>
          <PortField id={`${id}-port`} port={port} setPort={setPort} />
        </Disclosure>
      )}
    </>
  )
}

function TunnelChoice({ tunnel, setTunnel }: { tunnel: Tunnel; setTunnel(t: Tunnel): void }) {
  const m = useMessages(connectMessages)
  const privacy = useMessages(tunnelMessages).cloudflare.privacy
  const name = useId()
  const options = [
    { id: "tailscale", ...m.address.tailscale, warn: null },
    { id: "cloudflare", ...m.address.cloudflare, warn: privacy },
    { id: "own", ...m.address.own, warn: null },
  ] as const
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="sr-only">{m.address.legend}</legend>
      {options.map((o) => (
        <label
          key={o.id}
          htmlFor={`${name}-${o.id}`}
          className={cx(
            "flex cursor-pointer flex-col gap-1 rounded-inset border px-3.5 py-3 transition-colors duration-(--motion-fast) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand motion-reduce:transition-none",
            choiceOf(tunnel) === o.id ? "border-brand bg-brand-soft/40" : "border-line-strong hover:border-brand",
          )}
        >
          <span className="flex items-center gap-2">
            <Radio
              id={`${name}-${o.id}`}
              name={name}
              value={o.id}
              aria-labelledby={`${name}-${o.id}-title`}
              aria-describedby={`${name}-${o.id}-hint`}
              checked={choiceOf(tunnel) === o.id}
              onChange={() => setTunnel(o.id)}
              ring={false}
            />
            <span id={`${name}-${o.id}-title`} className="text-[0.95rem] font-semibold text-ink">
              {o.title}
            </span>
          </span>
          <span id={`${name}-${o.id}-hint`} className="flex flex-col gap-1">
            <span className="text-[0.9rem] text-ink-soft">{o.hint}</span>
            {o.warn && <span className="text-[0.9rem] text-warn-ink">{o.warn}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function PortField({ id, port, setPort }: { id: string; port: string; setPort(p: string): void }) {
  const m = useMessages(connectMessages)
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-[0.9rem] font-medium text-ink-dim">{m.address.port}</span>
      <input
        id={id}
        className={`${inputClass} w-28`}
        value={port}
        onChange={(e) => setPort(e.target.value)}
        inputMode="numeric"
      />
    </label>
  )
}
