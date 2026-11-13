import { Info, Smartphone, TriangleAlert } from "lucide-react"
import { useState } from "react"
import addDevice from "@/assets/signin/telegram-android-add-device.webp"
import createApp from "@/assets/signin/telegram-create-app.webp"
import credentials from "@/assets/signin/telegram-credentials.webp"
import type { KeyringFallback } from "@/domain/signin-notes"
import { isTelegramAppsUrl, type KeyHint, MY_TELEGRAM, type TelegramFailure, waitParts } from "@/domain/telegram-signin"
import { useMessages } from "@/i18n"
import { OpenLink } from "@/shared/OpenLink"
import { safeStorage } from "@/shared/safe-storage"
import type { OpenUrl } from "@/shared/signin-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { noticeBox } from "@/ui/notice"
import { Segmented } from "@/ui/Segmented"
import { type PhoneOs, telegramMessages } from "./messages-telegram"

export { MY_TELEGRAM }

export const isTelegramApps = (url: OpenUrl) => isTelegramAppsUrl(url.url)

type Shot = {
  src: string
  width: number
  height: number
  alt: string
  caption: string
  /** The small picture shows the bottom of a page whose part that matters is there. */
  bottom?: boolean
}

/**
 * my.telegram.org in three steps, with what its two pages look like. The pictures are the owner's own screens with
 * the app's name, its date and its api_id painted over (12345678 stands in for the id); the hash is blurred by the
 * site itself.
 */
export function TelegramAppGuide({ url }: { url: OpenUrl }) {
  const tm = useMessages(telegramMessages)
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
                className="mt-[0.15rem] grid size-[1.45rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.85rem] text-brand tabular-nums"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2">
                <div className="flex min-w-[16rem] flex-1 flex-col gap-2">
                  <p className="text-[1.1rem] leading-snug text-ink">{step}</p>
                  {i === 0 && <OpenLink url={url.url} />}
                </div>
                {shot && <ShotButton shot={shot} enlarge={tm.enlarge(shot.caption)} />}
                {i === 1 && <CreateWarning />}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * my.telegram.org answers a refused form with "Too many attempts" and locks the page for hours, and nothing but waiting
 * lifts it (owner, 2026-11-13), so the warning stands before the form is sent, not after.
 */
function CreateWarning() {
  const m = useMessages(telegramMessages).createWarning
  return (
    <div data-create-warning className={cx("flex w-full items-start gap-3", noticeBox("warn"))}>
      <TriangleAlert className="mt-[0.15rem] size-[1.1rem] shrink-0 text-warn-ink" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-[1rem] font-semibold leading-snug text-ink">{m.title}</p>
        <p className="text-[0.95rem] leading-snug text-ink-soft">{m.body}</p>
      </div>
    </div>
  )
}

/** A picture small beside its step, opened large in a dialog of its own over the sign-in. */
export function ShotButton({ shot, enlarge }: { shot: Shot; enlarge: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={enlarge}
        className="group flex w-[10.5rem] shrink-0 flex-col gap-1 rounded-pill text-left"
      >
        <img
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          className={cx(
            "h-auto max-h-[8.5rem] w-full rounded-pill border border-line object-cover transition-[border-color] duration-(--motion-fast) group-hover:border-line-strong",
            shot.bottom ? "object-bottom" : "object-top",
          )}
        />
        <span className="text-[0.85rem] leading-tight text-ink-dim group-hover:text-ink-soft">{shot.caption}</span>
      </button>
      <Dialog open={open} wide="xl" title={shot.caption} onClose={() => setOpen(false)}>
        <img
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          className="mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded-control"
        />
      </Dialog>
    </>
  )
}

const OS_KEY = "wirecat.signin.phone"

const savedOs = (): PhoneOs => (safeStorage.getItem(OS_KEY) === "iphone" ? "iphone" : "android")

/**
 * Where Telegram keeps its scanner differs by phone. Nothing is guessed from this computer: the first tab until the
 * owner picks one, then the one picked last. Only Android has a picture; there is no iPhone screenshot yet.
 */
export function TelegramScanSteps() {
  const tm = useMessages(telegramMessages)
  const [os, setOs] = useState<PhoneOs>(savedOs)
  const choose = (next: PhoneOs) => {
    setOs(next)
    safeStorage.setItem(OS_KEY, next)
  }
  const phone = <Smartphone className="size-4" aria-hidden />
  return (
    <div className="flex flex-col gap-3">
      <div className="self-start">
        <Segmented
          label={tm.scanPhone}
          value={os}
          labelClass=""
          onChange={choose}
          options={[
            { value: "android", label: "Android", icon: phone },
            { value: "iphone", label: "iPhone", icon: phone },
          ]}
        />
      </div>
      <AutoHeight swap={os}>
        <Crossfade swap={os}>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <ol className="flex min-w-[13rem] flex-1 list-decimal flex-col gap-1.5 pl-5 text-[1.1rem] leading-snug text-ink marker:text-ink-dim">
              {tm.scanSteps[os].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {os === "android" && (
              <ShotButton
                shot={{ src: addDevice, width: 576, height: 460, ...tm.scanShot }}
                enlarge={tm.enlarge(tm.scanShot.caption)}
              />
            )}
          </div>
        </Crossfade>
      </AutoHeight>
      <p className="text-body text-ink-soft">{tm.notCamera}</p>
    </div>
  )
}

/** The tool could not use the system's password store and saved the sign-in to a file instead: it works. */
export function KeyringNotice({ fallback }: { fallback: KeyringFallback }) {
  const tm = useMessages(telegramMessages)
  return (
    <div role="note" className="flex gap-3 rounded-pill border border-line bg-app-2 px-3 py-2.5 text-body">
      <Info className="mt-[0.15rem] size-[1.1rem] shrink-0 text-brand" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-medium text-ink">{tm.keyring.title}</p>
        <p className="leading-snug text-ink-soft">{tm.keyring.body}</p>
        <p className="text-ink-soft">
          {tm.keyring.file}:{" "}
          <code className="selectable font-mono text-[0.9rem] text-ink break-all">{fallback.path}</code>
        </p>
        {fallback.detail && (
          <Disclosure summary={tm.keyring.details}>
            <p className="text-[0.9rem] text-ink-soft">{tm.keyring.said}</p>
            <p className="selectable font-mono text-[0.85rem] text-ink-soft break-words">{fallback.detail}</p>
          </Disclosure>
        )}
      </div>
    </div>
  )
}

const clock = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/** Why Telegram refused, and what to do: one sentence each, Telegram's own name for it below. */
export function TelegramFailureText({ failure, hints = [] }: { failure: TelegramFailure; hints?: KeyHint[] }) {
  const tm = useMessages(telegramMessages)
  const said = tm.failures[failure.kind]
  const waits = failure.kind === "floodWait" && failure.seconds !== undefined
  const cause = waits ? tm.waitFor(tm.wait(waitParts(failure.seconds ?? 0))) : said.cause
  const fix = waits ? tm.waitUntil(clock(failure.seconds ?? 0)) : said.fix
  return (
    <>
      <span className="block font-medium text-ink">{cause}</span>
      <span className="mt-1 block text-body text-ink-soft">{fix}</span>
      {hints.length > 0 && (
        <span className="mt-1 block text-body text-ink-soft">
          {tm.keyHintsLead}
          <span className="block">
            {hints.map((h) => (
              <span key={h} className="block before:mr-1.5 before:text-ink-dim before:content-['–']">
                {tm.keyHints[h]}
              </span>
            ))}
          </span>
        </span>
      )}
      {failure.error && (
        <span className="mt-1 block text-[0.85rem] text-ink-dim">
          {tm.telegramSaid} <code className="font-mono">{failure.error}</code>
        </span>
      )}
    </>
  )
}
