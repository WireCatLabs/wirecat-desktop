import { CheckCircle2 } from "lucide-react"
import { useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { Background, BackgroundAction, BackgroundFault } from "@/platform/sync-schemas"
import { errorText } from "@/shared/errors"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useBackground, useProfiles, useRunBackground } from "./api"
import { type ServiceText, serviceMessages } from "./messages-service"
import { reconnect, SignInLost } from "./SignInLost"

type Done = { action: BackgroundAction; fault: null } | { action: BackgroundAction; fault: BackgroundFault }

const lamp = (s: Background | null): LampTone =>
  s?.state === "running" ? (s.connected === false ? "warn" : "ok") : s?.state === "stopped" ? "idle" : "off"

/**
 * A messenger's own `serve` in the background, one row per profile. The buttons are the tool's `server` commands
 * (`background` in the catalog); WireCat never writes a unit file, and a failure is sorted into one plain sentence
 * with the one thing to do next.
 */
export function Service({ tool }: { tool: CatalogTool }) {
  const m = useMessages(serviceMessages)
  const headingId = useId()
  const { profiles, reload } = useProfiles(tool.id)
  return (
    <section
      aria-labelledby={headingId}
      data-place={`service:${tool.id}`}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId} className="text-[1.02rem] font-semibold text-ink">
        {m.title}
      </h4>
      <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">
        {m.why(tool.name)} {tool.id === "wa" && m.whyPhone}
      </p>
      {profiles === undefined && <Skeleton className="h-[2.25rem] w-full max-w-[28rem]" label={m.loading} />}
      {profiles?.length === 0 && <p className="text-[0.9rem] text-ink-soft">{m.noProfile}</p>}
      {profiles && profiles.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-inset border border-line bg-app">
          {profiles.map((p) => (
            <ServiceRow key={p.name} tool={tool} profile={p.name} signedIn={p.signedIn} onSignedIn={reload} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ServiceRow(props: { tool: CatalogTool; profile: string; signedIn: boolean | null; onSignedIn: () => void }) {
  const { tool, profile, signedIn, onSignedIn } = props
  const m = useMessages(serviceMessages)
  const { state, recheck } = useBackground(tool.id, profile)
  const run = useRunBackground(tool.id, profile)
  const [done, setDone] = useState<Done | null>(null)
  const busy = run.isPending ? run.variables : null

  const go = (action: BackgroundAction) => {
    if (run.isPending) return
    setDone(null)
    run.mutate(action, {
      onSuccess: (o) => setDone({ action, fault: o.fault } as Done),
      onError: (e) => setDone({ action, fault: { kind: "other", message: errorText(e) } }),
    })
  }
  const signIn = () => reconnect(tool, profile, onSignedIn)

  const running = state?.state === "running"
  const unit = state?.state === "stopped" ? state.unit : running ? state.startsAtLogin : null
  const atLogin = state?.state === "unknown" || state === null ? null : state.startsAtLogin
  const needsSignIn = signedIn === false

  const headline =
    state === null
      ? null
      : state.state === "running"
        ? state.connected === false
          ? m.state.connecting
          : m.state.running
        : state.state === "stopped"
          ? m.state.stopped
          : m.state.unknown
  const loginLine = atLogin === true ? m.login.yes : atLogin === false || unit === true ? m.login.no : m.login.none

  const primary: { action: BackgroundAction; label: string } | null =
    needsSignIn || state === null
      ? null
      : running
        ? atLogin === false
          ? { action: "keep", label: m.startLogin }
          : null
        : { action: "keep", label: unit === true && atLogin === true ? m.start : m.startKeep }

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5" aria-label={m.region(`${tool.name} ${profile}`)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Lamp tone={needsSignIn ? "off" : lamp(state)} size="sm" />
        <div className="min-w-0 flex-1 basis-[14rem]">
          <p className="truncate font-medium">
            {profile}
            {headline && !needsSignIn && <span className="font-normal text-ink-soft"> · {headline}</span>}
          </p>
          <p className="text-[0.8rem] text-ink-dim">
            {needsSignIn ? m.signInFirst : state?.state === "unknown" ? m.state.unknown : loginLine}
          </p>
        </div>
        {state === null && !needsSignIn && <Skeleton className="h-[2rem] w-24" label={m.loading} />}
        {needsSignIn && (
          <Button size="sm" variant="secondary" onClick={signIn}>
            {m.signIn}
          </Button>
        )}
        {primary && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => go(primary.action)}
            aria-busy={busy === primary.action || undefined}
          >
            <StableText
              value={busy === "keep" ? m.working.keep : primary.label}
              variants={[m.start, m.startKeep, m.startLogin, m.working.keep]}
            />
          </Button>
        )}
        {running && (
          <Button size="sm" variant="secondary" onClick={() => go("stop")} aria-busy={busy === "stop" || undefined}>
            <StableText value={busy === "stop" ? m.working.stop : m.stop} variants={[m.stop, m.working.stop]} />
          </Button>
        )}
        {atLogin === true && !needsSignIn && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => go("uninstall")}
            aria-busy={busy === "uninstall" || undefined}
          >
            <StableText
              value={busy === "uninstall" ? m.working.uninstall : m.remove}
              variants={[m.remove, m.working.uninstall]}
            />
          </Button>
        )}
        {state?.state === "unknown" && (
          <Button size="sm" variant="ghost" onClick={recheck}>
            {m.checkAgain}
          </Button>
        )}
      </div>
      <Hints state={state} tool={tool} profile={profile} m={m} onSignIn={signIn} />
      <Result tool={tool} done={done} m={m} busy={busy !== null} go={go} signIn={signIn} />
    </li>
  )
}

function Hints({
  state,
  tool,
  profile,
  m,
  onSignIn,
}: {
  state: Background | null
  tool: CatalogTool
  profile: string
  m: ServiceText
  onSignIn: () => void
}) {
  const offline = state?.state === "running" && state.connected === false && tool.id === "wa"
  const gaveUp = state?.state === "stopped" ? state.stoppedFor : null
  const lost = gaveUp === "authentication_error"
  const text = offline ? m.phoneOffline : gaveUp && !lost ? m.gaveUp : null
  if (lost)
    return <SignInLost tool={tool} profile={profile} onReconnect={onSignIn} details={<p>{m.gaveUpSignedOut}</p>} />
  return (
    <Collapse open={text !== null}>
      <div className="flex flex-wrap items-center gap-3 text-[0.875rem] text-ink-soft">
        <p className="min-w-0 flex-1 basis-[16rem]" role="status">
          {text}
        </p>
      </div>
    </Collapse>
  )
}

const FALLBACK: Record<BackgroundFault["kind"], BackgroundAction | "update" | "signIn"> = {
  managerMissing: "start",
  loginInUse: "keep",
  notSignedIn: "signIn",
  tooOld: "update",
  permission: "keep",
  other: "keep",
}

/** What the last action did: one confirmation line, or one sentence about the failure with the one next step. */
function Result(props: {
  tool: CatalogTool
  done: Done | null
  m: ServiceText
  busy: boolean
  go: (a: BackgroundAction) => void
  signIn: () => void
}) {
  const { tool, done, m, busy, go, signIn } = props
  const fault = done?.fault ?? null
  const ok = done && !fault ? done : null
  const words = fault ? m.fault[fault.kind] : null
  const next = fault ? FALLBACK[fault.kind] : null
  const act = () => {
    if (next === "update") useTools.getState().install(tool.id, { check: true })
    else if (next === "signIn") signIn()
    else if (next) go(next)
  }
  const label = !words ? "" : typeof words.action === "function" ? words.action(tool.name) : words.action
  const text =
    !fault || !words ? "" : fault.kind === "other" ? m.fault.other.text(fault.message) : sentence(fault, words, tool)
  return (
    <>
      <Collapse open={fault !== null}>
        <ErrorNotice
          inline
          detail={words?.hint}
          action={
            <Button size="sm" variant="secondary" disabled={busy && next !== "update"} onClick={act}>
              {label}
            </Button>
          }
        >
          {text}
        </ErrorNotice>
      </Collapse>
      <Collapse open={ok !== null}>
        <p role="status" className="flex items-start gap-2 text-[0.875rem] text-ink-soft">
          <CheckCircle2 className="mt-[0.15rem] size-4 shrink-0 text-ok" aria-hidden />
          <span>{ok ? doneText(ok.action, tool.name, m) : ""}</span>
        </p>
      </Collapse>
    </>
  )
}

function sentence(fault: BackgroundFault, words: ServiceText["fault"][BackgroundFault["kind"]], tool: CatalogTool) {
  const t = words.text
  return typeof t === "function" ? (t as (s: string) => string)(fault.kind === "tooOld" ? tool.name : fault.message) : t
}

function doneText(action: BackgroundAction, tool: string, m: ServiceText) {
  switch (action) {
    case "keep":
      return m.done.keep(tool)
    case "start":
      return m.done.start(tool)
    case "stop":
      return m.done.stop
    case "uninstall":
      return m.done.uninstall
  }
}
