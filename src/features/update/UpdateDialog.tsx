import { Download, SquareTerminal } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { formatBytes } from "@/domain/format"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { UpdateFailure } from "@/platform/types"
import { externalHref } from "@/shared/external-href"
import { OpenLink } from "@/shared/OpenLink"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ProgressBar } from "@/ui/ProgressBar"
import { type UpdateMessages, updateMessages } from "./messages"
import { type Asked, downloadPage, updatesSection, useUpdate } from "./store"

const RELEASES = "https://github.com/WireCatLabs/wirecat-desktop/releases"

/** Shown only once an update is found; it sits left of "Report a problem", so nothing already there moves. */
export function UpdateButton() {
  const m = useMessages(updateMessages)
  const update = useUpdate((s) => s.update)
  const phase = useUpdate((s) => s.phase)
  if (!update) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="reveal text-brand"
      icon={<Download className="size-4" strokeWidth={1.8} aria-hidden />}
      onClick={() => useUpdate.getState().show()}
    >
      {phase === "downloading" ? m.updating : m.updateTo(update.version)}
    </Button>
  )
}

function Link({ href, children, quiet = false }: { href: string; children: ReactNode; quiet?: boolean }) {
  return (
    <button
      type="button"
      className={quiet ? "text-ink-dim underline hover:text-ink" : "text-brand underline hover:text-brand-hover"}
      onClick={() => platform.openUrl(href)}
      {...externalHref(href)}
    >
      {children}
    </button>
  )
}

function Progress() {
  const m = useMessages(updateMessages)
  const progress = useUpdate((s) => s.progress)
  const share = progress?.total ? Math.min(1, progress.downloaded / progress.total) : null
  return (
    <div className="flex flex-col gap-2">
      <ProgressBar
        label={m.downloadingLabel}
        value={share === null ? null : share * 100}
        size="line"
        pace="slow"
        minShare={4}
        className="w-full"
      />
      <p className="text-[0.9rem] text-ink-soft">
        {progress?.total ? m.downloaded(formatBytes(progress.downloaded), formatBytes(progress.total)) : m.downloading}
      </p>
    </div>
  )
}

function Saved() {
  const m = useMessages(updateMessages)
  const saved = useUpdate((s) => s.saved)
  const terminal = useUpdate((s) => s.terminal)
  if (!saved) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink">{saved.opened ? m.opened(saved.file) : m.revealed(saved.file)}</p>
      <p className="text-[0.9rem] text-ink-soft">{m.terminal}</p>
      <CopyField value={saved.command} label={m.copyCommand} wrap />
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={<SquareTerminal className="size-4" aria-hidden />}
          disabled={terminal === "opening"}
          onClick={() => useUpdate.getState().openTerminal()}
        >
          {m.openTerminal}
        </Button>
      </div>
      <div role="status">
        <AutoHeight swap={terminal}>
          <div key={terminal} className="step-in">
            {terminal === "opened" && <p className="text-[0.9rem] text-ink">{m.terminalOpened}</p>}
            {terminal === "missing" && <p className="text-[0.9rem] text-ink">{m.terminalMissing}</p>}
          </div>
        </AutoHeight>
      </div>
    </div>
  )
}

/** What went wrong and what to do; the technical text only in a small line under them. */
function explain(
  m: UpdateMessages,
  f: UpdateFailure | null,
  fallback = m.failed,
): { message: string; next: string; detail?: string | undefined } {
  switch (f?.reason) {
    case "offline":
      return { message: m.offline, next: m.offlineNext, detail: f.detail }
    case "server":
      return { message: m.server, next: m.serverNext, detail: f.detail }
    case "diskFull":
      return { message: m.diskFull(f.folder), next: m.diskFullNext, detail: f.detail }
    case "notWritable":
      return { message: m.notWritable(f.folder), next: m.notWritableNext, detail: f.detail }
    case "newer":
      return { message: m.newer(f.version), next: m.newerNext }
    default:
      return { message: fallback, next: m.failedDetail, detail: f?.detail }
  }
}

function Failed({ action, check = false }: { action: ReactNode; check?: boolean }) {
  const m = useMessages(updateMessages)
  const failure = useUpdate((s) => (check ? s.checkFailure : s.failure))
  const { message, next, detail } = explain(m, failure, check ? m.checkFailed : m.failed)
  return (
    <ErrorNotice
      action={action}
      detail={
        <>
          {next}
          {detail && <span className="mt-1 block break-words text-[0.8rem] text-ink-dim">{m.details(detail)}</span>}
        </>
      }
    >
      {message}
    </ErrorNotice>
  )
}

function releaseLinks(m: UpdateMessages, version: string) {
  return (
    <p className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[0.8rem]">
      <Link quiet href={`${RELEASES}/tag/v${version}`}>
        {m.whatsNew(version)}
      </Link>
      <Link quiet href={RELEASES}>
        {m.allReleases}
      </Link>
    </p>
  )
}

/** The Help menu's check before there is an update to offer: checking, up to date, or why it could not tell. */
function checkStep(m: UpdateMessages, asked: Asked, lang: Lang, pageButton: ReactNode) {
  const { close, checkNow } = useUpdate.getState()
  const title = asked === "latest" ? m.latestTitle : asked === "failed" ? m.checkFailedTitle : m.checking
  const actions =
    asked === "failed" ? (
      <>
        <Button variant="secondary" onClick={close}>
          {m.close}
        </Button>
        <Button variant="primary" data-autofocus data-update-next onClick={() => checkNow()}>
          {m.tryAgain}
        </Button>
      </>
    ) : (
      <Button variant={asked === "latest" ? "primary" : "secondary"} data-autofocus data-update-next onClick={close}>
        {m.close}
      </Button>
    )
  const body = (
    <>
      {asked === "checking" && (
        <>
          <ProgressBar label={m.checking} value={null} size="line" className="w-full" />
          <p className="text-[0.9rem] text-ink-soft">{m.checkingDetail}</p>
        </>
      )}
      {asked === "latest" && (
        <p className="text-ink-soft">
          {m.latest(__APP_VERSION__)} <Link href={updatesSection(lang)}>{m.howUpdates}</Link>
        </p>
      )}
      {asked === "failed" && <Failed check action={pageButton} />}
    </>
  )
  return { title, actions, body, footer: asked === "latest" ? releaseLinks(m, __APP_VERSION__) : undefined }
}

/** One surface for the whole flow: a check from the Help menu turns into the offer in place when it finds one. */
export function UpdateDialog() {
  const m = useMessages(updateMessages)
  const lang = useLang()
  const { update, open, phase, asked } = useUpdate()
  // The pressed button went away with the download; the step's own button takes the focus, not the page behind.
  useEffect(() => {
    if (phase === "saved") document.querySelector<HTMLElement>("[data-update-done]")?.focus()
  }, [phase])
  const step = update ? "offer" : asked
  // The check's answer replaces the buttons, and with them the one that had the focus.
  useEffect(() => {
    if (step !== "idle") document.querySelector<HTMLElement>("[data-update-next]")?.focus()
  }, [step])
  const close = () => useUpdate.getState().close()
  const pageButton = <OpenLink url={downloadPage(lang)}>{m.openDownloadPage}</OpenLink>

  if (!update) {
    const { title, actions, body, footer } = checkStep(m, asked, lang, pageButton)
    return (
      <Dialog open={open && asked !== "idle"} title={title} onClose={close} actions={actions} footer={footer}>
        <AutoHeight swap={step}>
          <div key={step} className="step-in flex flex-col gap-4">
            {body}
          </div>
        </AutoHeight>
      </Dialog>
    )
  }

  const busy = phase === "downloading" || phase === "restarting"
  const intro = update.kind === "self" ? m.auto : update.kind === "other" ? m.other : m.package[update.kind]

  let actions: ReactNode
  if (update.kind === "other") {
    actions = (
      <>
        <Button variant="secondary" onClick={close}>
          {m.later}
        </Button>
        <OpenLink
          url={downloadPage(lang)}
          variant="primary"
          size="md"
          marks={{ "data-autofocus": true, "data-update-next": true }}
        >
          {m.openDownloadPage}
        </OpenLink>
      </>
    )
  } else if (phase === "saved") {
    actions = (
      <Button variant="primary" data-update-done onClick={close}>
        {m.close}
      </Button>
    )
  } else {
    const label = update.kind === "self" ? m.install : m.downloadAndInstall
    actions = (
      <>
        <Button variant="secondary" onClick={close}>
          {busy ? m.hide : m.later}
        </Button>
        <Button
          variant="primary"
          data-autofocus
          data-update-next
          disabled={busy}
          onClick={() => useUpdate.getState().install()}
        >
          {phase === "failed" || phase === "rejected" ? m.tryAgain : label}
        </Button>
      </>
    )
  }

  return (
    <Dialog
      open={open}
      title={m.available(update.version)}
      onClose={close}
      actions={actions}
      footer={releaseLinks(m, update.version)}
    >
      <AutoHeight swap={step}>
        <div key={step} className="step-in flex flex-col gap-4">
          <p className="text-ink-soft">
            {intro} <Link href={updatesSection(lang)}>{m.howUpdates}</Link>
          </p>
          {update.notes && (
            <div className="selectable max-h-[12rem] overflow-y-auto whitespace-pre-line rounded-[0.2rem] border border-line bg-app-2 px-4 py-3 text-[0.9rem]">
              {update.notes}
            </div>
          )}
          <AutoHeight swap={phase}>
            <div key={phase} className={phase === "available" ? undefined : "step-in"}>
              {phase === "downloading" && <Progress />}
              {phase === "restarting" && <p className="text-[0.9rem] text-ink-soft">{m.restarting}</p>}
              {phase === "saved" && <Saved />}
              {phase === "rejected" && (
                <ErrorNotice detail={m.rejectedDetail} action={pageButton}>
                  {m.rejected}
                </ErrorNotice>
              )}
              {phase === "failed" && <Failed action={pageButton} />}
            </div>
          </AutoHeight>
        </div>
      </AutoHeight>
    </Dialog>
  )
}
