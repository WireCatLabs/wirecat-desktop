import { ExternalLink, Info } from "lucide-react"
import { useState } from "react"
import createApp from "@/assets/signin/telegram-create-app.webp"
import credentials from "@/assets/signin/telegram-credentials.webp"
import type { KeyringFallback } from "@/domain/signin-notes"
import { type TelegramFailure, waitParts } from "@/domain/telegram-signin"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { signinMessages } from "./messages"
import { telegramMessages } from "./messages-telegram"
import type { OpenUrl } from "./store"

export const MY_TELEGRAM = "my.telegram.org"

export const isTelegramApps = (url: OpenUrl) => new URL(url.url).host === MY_TELEGRAM

/**
 * Opens the page; `copy` adds its link for a browser the system did not choose. Only for a plain page: a sign-in link
 * carries a login token, and the clipboard is not where it belongs.
 */
export function OpenLink({ url, primary = false, copy = false }: { url: string; primary?: boolean; copy?: boolean }) {
  const m = useMessages(signinMessages)
  const tm = useMessages(telegramMessages)
  const host = new URL(url).host
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={primary ? "primary" : "secondary"}
        size={primary ? "md" : "sm"}
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={() => platform.openUrl(url)}
      >
        {m.openHost(host)}
      </Button>
      {copy && <CopyButton value={url} label={tm.copyLink(host)} />}
    </div>
  )
}

type Shot = { src: string; width: number; height: number; alt: string; caption: string }

/**
 * my.telegram.org in three steps, with what its two pages look like. The pictures are the owner's own screens with
 * the app's name, its date and its api_id painted over (12345678 stands in for the id); the hash is blurred by the
 * site itself.
 */
export function TelegramAppGuide({ url }: { url: OpenUrl }) {
  const tm = useMessages(telegramMessages)
  const [open, setOpen] = useState<Shot | null>(null)
  const shots: (Shot | null)[] = [
    null,
    { src: createApp, width: 760, height: 790, ...tm.shots.create },
    { src: credentials, width: 800, height: 405, ...tm.shots.credentials },
  ]
  return (
    <section aria-label={tm.guideTitle} className="flex w-full flex-col gap-3 text-left">
      <ol className="flex flex-col gap-3">
        {tm.appSteps.map((step, i) => {
          const shot = shots[i]
          return (
            <li key={step} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-[0.1rem] grid size-[1.3rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.8rem] text-brand tabular-nums"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2">
                <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
                  <p className="text-[0.9rem] leading-snug text-ink">{step}</p>
                  {i === 0 && <OpenLink url={url.url} copy />}
                </div>
                {shot && (
                  <button
                    type="button"
                    onClick={() => setOpen(shot)}
                    aria-label={tm.enlarge(shot.caption)}
                    className="group flex w-[9.5rem] shrink-0 flex-col gap-1 text-left"
                  >
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      width={shot.width}
                      height={shot.height}
                      className="h-auto max-h-[8rem] w-full rounded-[0.3rem] border border-line object-cover object-top transition-[border-color] duration-150 group-hover:border-line-strong"
                    />
                    <span className="text-[0.75rem] leading-tight text-ink-dim group-hover:text-ink-soft">
                      {shot.caption}
                    </span>
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <Dialog open={open !== null} wide="xl" title={open?.caption ?? ""} onClose={() => setOpen(null)}>
        {open && (
          <img
            src={open.src}
            alt={open.alt}
            width={open.width}
            height={open.height}
            className="mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded-[0.35rem]"
          />
        )}
      </Dialog>
    </section>
  )
}

/** The tool could not use the system's password store and saved the sign-in to a file instead: it works. */
export function KeyringNotice({ fallback }: { fallback: KeyringFallback }) {
  const tm = useMessages(telegramMessages)
  return (
    <div role="note" className="flex gap-3 rounded-[0.3rem] border border-line bg-app-2 px-3 py-2.5 text-[0.9rem]">
      <Info className="mt-[0.15rem] size-[1.1rem] shrink-0 text-brand" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-medium text-ink">{tm.keyring.title}</p>
        <p className="leading-snug text-ink-soft">{tm.keyring.body}</p>
        <p className="text-ink-soft">
          {tm.keyring.file}:{" "}
          <code className="selectable font-mono text-[0.85rem] text-ink break-all">{fallback.path}</code>
        </p>
        {fallback.detail && (
          <Disclosure summary={tm.keyring.details}>
            <p className="text-[0.85rem] text-ink-soft">{tm.keyring.said}</p>
            <p className="selectable font-mono text-[0.8rem] text-ink-soft break-words">{fallback.detail}</p>
          </Disclosure>
        )}
      </div>
    </div>
  )
}

const clock = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/** Why Telegram refused, and what to do: one sentence each, Telegram's own name for it below. */
export function TelegramFailureText({ failure }: { failure: TelegramFailure }) {
  const tm = useMessages(telegramMessages)
  const said = tm.failures[failure.kind]
  const waits = failure.kind === "floodWait" && failure.seconds !== undefined
  const cause = waits ? tm.waitFor(tm.wait(waitParts(failure.seconds ?? 0))) : said.cause
  const fix = waits ? tm.waitUntil(clock(failure.seconds ?? 0)) : said.fix
  return (
    <>
      <span className="block font-medium text-ink">{cause}</span>
      <span className="mt-1 block text-[0.9rem] text-ink-soft">{fix}</span>
      {failure.error && (
        <span className="mt-1 block text-[0.8rem] text-ink-dim">
          {tm.telegramSaid} <code className="font-mono">{failure.error}</code>
        </span>
      )}
    </>
  )
}
