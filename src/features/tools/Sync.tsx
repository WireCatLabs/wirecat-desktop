import { AlertTriangle, CheckCircle2, CircleStop, LoaderCircle, RefreshCw, ScrollText, X } from "lucide-react"
import { useEffect, useState } from "react"
import { type CatalogTool, ownerId, syncCommand, syncNeedsProfile, syncsHere } from "@/domain/catalog"
import { toolStatus } from "@/domain/status"
import { type AdviceKind, advice, clock, type SyncFailure, type SyncWhat, share } from "@/domain/sync"
import { useLogs } from "@/features/logs"
import { useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import type { LastSync } from "@/platform/sync-schemas"
import { accountTitle, useAccountNames } from "@/shared/account-names-store"
import { useNav } from "@/shared/nav"
import { ReportThis } from "@/shared/ReportThis"
import { useTools } from "@/shared/tools-store"
import { useElapsed } from "@/shared/use-elapsed"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ProgressBar } from "@/ui/ProgressBar"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { type SyncText, syncMessages } from "./messages-sync"
import { SignInLost } from "./SignInLost"
import { blockedBy, type SyncRun, syncKey, useSync } from "./sync-store"

type Words = SyncText

const NO_FAILURE: SyncFailure = { message: "", code: null, reason: null, run: null }

/**
 * "Last synced 12 min ago". With no time the tool still may have synced: a run log keeps a success only when asked
 * (`--record`, which the app passes), and drive sets its time only once nothing is left to fetch.
 */
function lastLine(last: LastSync, what: SyncWhat, m: Words): string {
  if (!last.known) return m.lastUnknown
  const left = last.left && last.left > 0 ? m.left(what, last.left) : null
  if (last.at) return [m.lastSynced(ago(last.at)), left].filter(Boolean).join(" · ")
  return left ? m.notFinished(left) : m.noneRecorded
}

/** One profile's sync: what the button, the status line and the follow-up under them share. */
export function useSyncControl(tool: CatalogTool, profile: string | null) {
  const key = syncKey(tool.id, profile)
  const run = useSync((s) => s.runs[key])
  const last = useSync((s) => s.last[key])
  const blocked = useSync((s) => run?.phase !== "running" && blockedBy(s.runs, tool.id, profile))
  const [refused, setRefused] = useState(false)
  useEffect(() => {
    if (!blocked) setRefused(false)
  }, [blocked])

  useEffect(() => {
    void useSync.getState().loadLast(tool.id, profile)
  }, [tool.id, profile])

  const what: SyncWhat = tool.sync?.what ?? "messages"
  return { tool, profile, run, last, blocked, refused, refuse: () => setRefused(true), what }
}

type Control = ReturnType<typeof useSyncControl>

/** When it last synced, the running sync's progress, or how the last one ended. */
export function SyncStatus({ c }: { c: Control }) {
  const m = useMessages(syncMessages).sync
  const { run, last, what } = c
  return (
    <div className="min-w-0 flex-1" aria-live="polite">
      {run?.phase === "running" ? (
        <Progress run={run} m={m} />
      ) : run ? (
        <Outcome run={run} what={what} m={m} />
      ) : last ? (
        <p className={LAST_LINE}>{lastLine(last, what, m)}</p>
      ) : (
        <SyncStatusLoading />
      )}
    </div>
  )
}

const LAST_LINE = "text-[0.875rem] text-ink-soft tabular-nums"

/** "Last synced …" while it is read: in the line's own font, so the line keeps its height. */
export function SyncStatusLoading() {
  const m = useMessages(syncMessages).sync
  return (
    <p className={LAST_LINE}>
      <Skeleton chars={22} label={m.readingLast} />
    </p>
  )
}

/** Sync, or Stop while it runs. `name` goes into its accessible name where several rows each have one. */
export function SyncButton({ c, name }: { c: Control; name?: string }) {
  const m = useMessages(syncMessages).sync
  const { start, stop } = useSync.getState()
  const { tool, profile, run, blocked } = c
  if (run?.phase === "running") {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => stop(tool.id, profile)}
        disabled={run.stopping}
        aria-label={name ? m.stopSyncing(name) : undefined}
        icon={<CircleStop className="size-4" aria-hidden />}
      >
        <StableText value={run.stopping ? m.stopping : m.stop} variants={[m.stop, m.stopping]} />
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant={run ? "secondary" : "primary"}
      onClick={() => (blocked ? c.refuse() : start(tool.id, profile))}
      title={blocked ? m.anotherRunning : undefined}
      aria-label={name ? m.syncNamed(name) : undefined}
      icon={<RefreshCw className="size-4" aria-hidden />}
    >
      <StableText value={run ? m.syncAgain : m.syncNow} variants={[m.syncNow, m.syncAgain]} />
    </Button>
  )
}

/** Why a sync was refused, and what to do after one ended. */
export function SyncFollowUp({ c }: { c: Control }) {
  const m = useMessages(syncMessages).sync
  const { run } = c
  const running = run?.phase === "running"
  return (
    <>
      <Collapse open={c.refused && c.blocked}>
        <ErrorNotice inline>{m.anotherRunning}</ErrorNotice>
      </Collapse>
      <AutoHeight swap={running ? "running" : (run?.phase ?? "idle")}>
        {run && !running ? <Next run={run} tool={c.tool} profile={c.profile} what={c.what} m={m} /> : null}
      </AutoHeight>
    </>
  )
}

/** A tool's sync with no profile in the Manage panel: the button, when it last ran, its progress and its result. */
export function SyncControl({ tool, profile }: { tool: CatalogTool; profile: string | null }) {
  const c = useSyncControl(tool, profile)
  const m = useMessages(syncMessages).sync
  if (!syncsHere(tool)) return null
  const label = m.region(profile ? `${tool.name} ${profile}` : tool.name)

  return (
    <section className="flex flex-col gap-1.5" aria-label={label} data-place={`sync:${tool.id}`}>
      <div className="flex min-h-[2.25rem] items-center gap-3">
        <SyncStatus c={c} />
        <SyncButton c={c} />
      </div>
      <SyncFollowUp c={c} />
    </section>
  )
}

/** A refusal's own words can name chats or people (RISK-44); these kinds speak only of the account or the pause. */
const OWN_WORDS_SAFE = new Set<AdviceKind>(["signedOut", "keyring", "rateLimited", "unreachable", "timeout"])

function Progress({ run, m }: { run: SyncRun; m: Words }) {
  const elapsed = useElapsed(run.startedAt)
  const counted = run.progress ? m.progress(run.progress) : null
  const stage = run.stopping ? m.stoppingKeeping : (counted ?? run.stage ?? m.starting)
  const pct = run.stopping ? null : share(run.progress)
  return (
    <div className="flex flex-col gap-1">
      <ProgressBar
        label={m.syncing}
        value={pct}
        valueText={stage}
        pace="slow"
        minShare={3}
        className="w-full max-w-[22rem]"
      />
      <p className="flex gap-2 text-[0.9rem] text-ink-soft tabular-nums">
        <span className="min-w-0">
          {stage}
          {counted ? "" : "…"}
        </span>
        <span className="shrink-0 font-mono text-ink-dim">{clock(elapsed)}</span>
      </p>
    </div>
  )
}

function Outcome({ run, what, m }: { run: SyncRun; what: SyncWhat; m: Words }) {
  const took = run.endedAt ? clock(run.endedAt - run.startedAt) : null
  if (run.phase === "done" && run.summary) {
    return (
      <p className="reveal flex items-center gap-2 text-[0.9rem] font-medium text-ink">
        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
        <span className="min-w-0">{m.result(what, run.summary)}</span>
        {took && (
          <span className="shrink-0 font-mono text-[0.85rem] font-normal text-ink-dim tabular-nums">{took}</span>
        )}
      </p>
    )
  }
  if (run.phase === "stopped") {
    return (
      <p className="reveal flex items-center gap-2 text-[0.9rem] font-medium text-ink">
        <CircleStop className="size-4 shrink-0 text-ink-soft" aria-hidden />
        {m.stopped}
      </p>
    )
  }
  return (
    <p className="reveal flex items-center gap-2 text-[0.9rem] font-medium text-ink">
      <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
      <span className="min-w-0">{m.advice[advice(run.failure ?? NO_FAILURE).kind]}</span>
    </p>
  )
}

function Next(props: { run: SyncRun; tool: CatalogTool; profile: string | null; what: SyncWhat; m: Words }) {
  const { run, tool: entry, profile, what, m } = props
  const dismiss = () => useSync.getState().dismiss(entry.id, profile)
  const outdated = useTools(
    (s) =>
      toolStatus(
        s.installs[entry.id],
        s.latest ? (s.latest[entry.id] ?? null) : undefined,
        s.sessions[ownerId(entry.id)],
      ).kind === "outdated",
  )
  const close = (
    <Button
      size="sm"
      variant="ghost"
      onClick={dismiss}
      aria-label={m.dismiss}
      icon={<X className="size-4" aria-hidden />}
    />
  )
  let body: React.ReactNode
  if (run.phase === "done" && run.summary) {
    body = <p>{m.next(what, run.summary) ?? m.done(what)}</p>
  } else if (run.phase === "stopped") {
    body = <p>{m.stoppedNext}</p>
  } else {
    const failure = run.failure ?? NO_FAILURE
    const a = advice(failure)
    const details = (failure.code || failure.run) && (
      <div className="flex flex-col items-start gap-2">
        {OWN_WORDS_SAFE.has(a.kind) && failure.message && <p className="selectable">{failure.message}</p>}
        {failure.code && (
          <p className="selectable font-mono text-[0.85rem]">
            {[failure.code, failure.reason].filter(Boolean).join(" · ")}
          </p>
        )}
        <Button
          size="sm"
          variant="secondary"
          icon={<ScrollText className="size-4" strokeWidth={1.8} aria-hidden />}
          onClick={() => openRun(entry, failure.run)}
        >
          {m.openRun}
        </Button>
      </div>
    )
    body =
      a.kind === "signedOut" || a.kind === "keyring" ? (
        <SignInLost
          tool={entry}
          profile={profile}
          cause={a.kind === "keyring" ? "keyring" : "ended"}
          details={details}
          inline
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p>
            {a.kind === "rateLimited"
              ? m.slowDown(entry.name, waitUntil(run.endedAt, failure.retryAfterMs))
              : m.adviceText(a.kind, profile ?? entry.name, failure.message, Boolean(a.logs))}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {a.update && outdated && (
              <Button size="sm" onClick={() => useTools.getState().install(entry.id, { check: true })}>
                {m.update(entry.name)}
              </Button>
            )}
            {a.report && (
              <ReportThis
                what={`Syncing ${entry.name}`}
                tool={entry.id}
                error={failure.message || syncMessages.en.sync.adviceText("failed", "", "", false)}
              />
            )}
          </div>
          {details && <Disclosure summary={m.details}>{details}</Disclosure>}
        </div>
      )
  }
  return (
    <div
      className={cx(
        "reveal flex items-start gap-2 rounded-[0.35rem] px-3 py-2 text-[0.875rem] text-ink-soft",
        run.phase === "failed" ? "bg-warn/10" : "bg-app",
      )}
    >
      <div className="min-w-0 flex-1">{body}</div>
      {close}
    </div>
  )
}

/** When the service said the next sync may start, as minutes from the end of this one and a clock time. */
function waitUntil(endedAt: number | null, waitMs: number | null | undefined) {
  if (!waitMs || waitMs <= 0) return null
  const at = (endedAt ?? Date.now()) + waitMs
  return { minutes: Math.max(1, Math.ceil(waitMs / 60_000)), at }
}

/** The Logs page, at the failed run when the tool named it, else at this tool's failed syncs. */
function openRun(entry: CatalogTool, run: string | null) {
  useLogs.getState().openRun(run, `command:"${syncCommand(entry)}" status:failed`)
  useNav.getState().go("logs")
}

/** The Tools row's compact line: a running sync, its result, or when the only profile last synced. */
export function useRowSync(entry: CatalogTool, installed: boolean) {
  const profiles = useSync((s) => s.profiles[entry.id])
  useEffect(() => {
    if (installed) useSync.getState().loadRow(entry.id)
  }, [entry.id, installed])
  const single = !syncNeedsProfile(entry) ? null : profiles?.length === 1 ? (profiles[0] ?? null) : undefined
  const runs = useSync((s) => s.runs)
  const lastAll = useSync((s) => s.last)
  if (!installed || !syncsHere(entry)) return null
  const mine = Object.entries(runs).filter(([k]) => k.startsWith(`${entry.id}:`))
  const active = mine.find(([, r]) => r.phase === "running") ?? mine.at(-1)
  const profileOf = (k: string) => k.slice(entry.id.length + 1) || null
  if (active) return { profile: profileOf(active[0]), run: active[1], last: null, canStart: false }
  const last = single === undefined ? undefined : lastAll[syncKey(entry.id, single)]
  // Until the time is read the tagline stays, so the row never shows a placeholder in its place.
  if (single === undefined || !last) return null
  return { profile: single, run: null, last, canStart: true }
}

export function RowSyncLine({ entry, info }: { entry: CatalogTool; info: NonNullable<ReturnType<typeof useRowSync>> }) {
  const what = entry.sync?.what ?? "messages"
  const title = useAccountNames((n) => (info.profile ? accountTitle(n.names, entry.id, info.profile) : null))
  const who = title && syncNeedsProfile(entry) ? `${title} · ` : ""
  const m = useMessages(syncMessages).sync
  const elapsed = useElapsed(info.run?.phase === "running" ? info.run.startedAt : null)
  if (info.run?.phase === "running") {
    return (
      <span className="flex min-w-0 items-center gap-2 tabular-nums">
        <LoaderCircle className="size-3.5 shrink-0 motion-safe:animate-spin text-brand" aria-hidden />
        <span className="truncate">
          {who}
          {info.run.stopping
            ? m.stopping
            : ((info.run.progress && m.progress(info.run.progress)) ?? `${info.run.stage ?? m.syncing}…`)}{" "}
          {clock(elapsed)}
        </span>
      </span>
    )
  }
  if (info.run) {
    const text =
      info.run.phase === "done" && info.run.summary
        ? m.result(what, info.run.summary)
        : info.run.phase === "stopped"
          ? m.rowStopped
          : m.rowFailed(m.advice[advice(info.run.failure ?? NO_FAILURE).kind])
    return (
      <span className="truncate">
        {who}
        {text}
      </span>
    )
  }
  return info.last ? (
    <span className="reveal truncate tabular-nums">
      {who}
      {lastLine(info.last, what, m)}
    </span>
  ) : null
}

/** The row's own Sync or Stop, beside the name, for a tool with one profile or none. */
export function RowSyncButton({
  entry,
  info,
}: {
  entry: CatalogTool
  info: NonNullable<ReturnType<typeof useRowSync>>
}) {
  const { start, stop } = useSync.getState()
  const running = info.run?.phase === "running"
  const name = info.profile ? `${entry.name} ${info.profile}` : entry.name
  const m = useMessages(syncMessages).sync
  if (!running && !info.canStart && !info.run) return null
  return (
    <button
      type="button"
      className="inline-flex size-9 items-center justify-center rounded-[0.35rem] text-ink-soft transition-colors duration-(--motion-fast) hover:bg-app-3 hover:text-ink disabled:opacity-45"
      aria-label={running ? m.stopSyncing(name) : m.syncNamed(name)}
      title={running ? m.stopTitle : m.syncNow}
      disabled={running && info.run?.stopping}
      onClick={() => (running ? stop(entry.id, info.profile) : start(entry.id, info.profile))}
    >
      {running ? (
        <CircleStop className="size-[1.15rem]" aria-hidden />
      ) : (
        <RefreshCw className="size-[1.15rem]" aria-hidden />
      )}
    </button>
  )
}
