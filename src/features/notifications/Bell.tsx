import { Bell as BellIcon, CircleArrowUp, ExternalLink, Megaphone, ShieldAlert, X } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Localized, Notification } from "@/platform/notifications-schemas"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { focusInPlace, reducedMotion } from "@/ui/motion"
import { notificationMessages } from "./messages"
import { unread, useNotifications, visible } from "./store"

const text = (t: { [L in keyof Localized]?: string | undefined }, lang: Lang) => t[lang] || t.en || ""

const DAY = 86_400_000
const CLOSE_MS = 150

function when(iso: string, lang: Lang, now = Date.now()) {
  const at = Date.parse(iso)
  const ago = now - at
  const rel = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })
  if (ago < 3_600_000) return rel.format(-Math.max(1, Math.round(ago / 60_000)), "minute")
  if (ago < DAY) return rel.format(-Math.round(ago / 3_600_000), "hour")
  if (ago < 7 * DAY) return rel.format(-Math.round(ago / DAY), "day")
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(at)
}

const SEVERITY: Record<Notification["severity"], { icon: ReactNode; label: string }> = {
  security: {
    icon: <ShieldAlert className="size-[1.15rem] text-bad" strokeWidth={1.8} aria-hidden />,
    label: "text-ink",
  },
  update: { icon: <CircleArrowUp className="size-[1.15rem]" strokeWidth={1.8} aria-hidden />, label: "text-warn-ink" },
  info: { icon: <Megaphone className="size-[1.15rem]" strokeWidth={1.8} aria-hidden />, label: "text-brand" },
}

export function Bell() {
  const m = useMessages(notificationMessages)
  const open = useNotifications((s) => s.open)
  const count = useNotifications((s) => unread(s).length)
  const security = useNotifications((s) => unread(s).some((n) => n.severity === "security"))
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  // Stays mounted while it fades out after closing, so it does not vanish (rule 9).
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => setMounted(false), reducedMotion() ? 0 : CLOSE_MS)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = useNotifications.getState().close
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      close()
      trigger.current?.focus()
    }
    // Tabbing past the last item leaves the panel; it closes rather than stay open behind the focus.
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) close()
    }
    const el = root.current
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    el?.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      el?.removeEventListener("focusout", onFocusOut)
    }
  }, [open])

  const label = security ? m.bellSecurity : count > 0 ? m.bellUnread(count) : m.bell
  return (
    <div ref={root} className="relative flex h-full items-center">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => useNotifications.getState().toggle()}
        className={cx(
          "relative grid size-[2.2rem] place-items-center rounded-[0.4rem] text-ink-soft hover:bg-app-3 hover:text-ink",
          open && "bg-app-3 text-ink",
        )}
      >
        <BellIcon className="size-[1.2rem]" strokeWidth={1.8} aria-hidden />
        <span
          aria-hidden
          className={cx(
            "absolute top-[0.4rem] right-[0.4rem] size-[0.6rem] rounded-full ring-2 ring-wall transition-[opacity,scale] duration-200",
            security ? "bg-bad" : "bg-brand",
            count > 0 ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </button>
      {mounted && <Panel id={panelId} leaving={!open} />}
    </div>
  )
}

function Panel({ id, leaving }: { id: string; leaving: boolean }) {
  const m = useMessages(notificationMessages)
  const lang = useLang()
  const items = useNotifications((s) => s.items)
  const dismissed = useNotifications((s) => s.dismissed)
  const fresh = useNotifications((s) => s.fresh)
  const failed = useNotifications((s) => s.failed && !s.checked)
  // Removed before this opening: never drawn. Removed now: folds away in place, so nothing jumps.
  const [hidden] = useState(() => dismissed)
  const heading = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const shown = visible({ items, dismissed: hidden })
  const left = visible({ items, dismissed })

  useEffect(() => focusInPlace(heading.current), [])

  return (
    <section
      id={id}
      role="dialog"
      aria-labelledby={headingId}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
      className={cx(
        "absolute top-[calc(100%-0.3rem)] right-0 z-30 flex max-h-[min(36rem,calc(100vh-5rem))] w-[27rem] flex-col overflow-hidden rounded-[0.6rem] border border-line bg-app shadow-panel",
        leaving
          ? "pointer-events-none animate-[dialog-out_150ms_var(--ease-out-quart)_forwards]"
          : "motion-safe:animate-[select-in_160ms_var(--ease-out-quart)]",
      )}
    >
      <h2
        ref={heading}
        id={headingId}
        tabIndex={-1}
        className="step-heading shrink-0 border-line border-b px-[1.1rem] py-[0.8rem] font-semibold text-[1.05rem] text-ink"
      >
        {m.title}
      </h2>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <ul>
          {shown.map((n) => (
            <Collapse key={n.id} open={!dismissed.includes(n.id)}>
              <Item
                notification={n}
                isNew={fresh.includes(n.id)}
                lang={lang}
                onDismiss={() => {
                  useNotifications.getState().dismiss(n.id)
                  focusInPlace(heading.current)
                }}
              />
            </Collapse>
          ))}
        </ul>
        <Collapse open={left.length === 0}>
          <div className="px-[1.1rem] py-[1.6rem] text-center">
            <p className="font-medium text-ink">{failed ? m.offline : m.empty}</p>
            <p className="mx-auto mt-[0.3rem] max-w-[22rem] text-[0.95rem] text-ink-soft leading-relaxed">
              {failed ? m.offlineText : m.emptyText}
            </p>
          </div>
        </Collapse>
      </div>
    </section>
  )
}

function Item({
  notification: n,
  isNew,
  lang,
  onDismiss,
}: {
  notification: Notification
  isNew: boolean
  lang: Lang
  onDismiss: () => void
}) {
  const m = useMessages(notificationMessages)
  const title = text(n.title, lang)
  const severity = SEVERITY[n.severity]
  return (
    <li
      className={cx(
        "group relative flex gap-[0.75rem] border-line border-b py-[0.95rem] pr-[0.7rem] pl-[1.1rem]",
        n.severity === "security" ? "bg-bad/[0.07]" : isNew && "bg-brand-soft/45",
      )}
    >
      <span className={cx("mt-[0.1rem] shrink-0", severity.label)}>{severity.icon}</span>
      <div className="selectable min-w-0 flex-1">
        <p className="flex items-center gap-[0.45rem] text-[0.85rem]">
          <span className={cx("font-medium", severity.label)}>{m.severity[n.severity]}</span>
          <span aria-hidden className="text-ink-soft">
            ·
          </span>
          <time dateTime={n.publishedAt} className="text-ink-soft">
            {when(n.publishedAt, lang)}
          </time>
          {isNew && (
            <span className="ml-[0.1rem] inline-flex items-center gap-[0.3rem] font-medium text-brand">
              <span aria-hidden className="size-[0.4rem] rounded-full bg-brand" />
              {m.isNew}
            </span>
          )}
        </p>
        <h3 className="mt-[0.25rem] font-semibold text-[1rem] text-ink leading-snug">{title}</h3>
        {text(n.body, lang)
          .split(/\n\s*\n/)
          .map((para, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one fixed text never reorder
            <p key={i} className="mt-[0.4rem] text-[0.95rem] text-ink-soft leading-relaxed whitespace-pre-line">
              {para}
            </p>
          ))}
        {n.link && (
          <button
            type="button"
            title={n.link.url}
            onClick={() => n.link && platform.openUrl(n.link.url)}
            className="mt-[0.55rem] inline-flex items-center gap-1 font-medium text-[0.95rem] text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {text(n.link.label, lang) || n.link.url}
            <ExternalLink className="size-[0.85em] shrink-0" strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={m.dismiss(title)}
        title={m.dismiss(title)}
        onClick={onDismiss}
        className="grid size-[1.9rem] shrink-0 place-items-center self-start rounded-[0.35rem] text-ink-dim opacity-60 hover:bg-app-3 hover:text-ink hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-[1rem]" strokeWidth={1.8} aria-hidden />
      </button>
    </li>
  )
}
