import { X } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { MOTION, reducedMotion } from "./motion"

const CLOSE_MS = MOTION.exit
const FOCUSABLE =
  "button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])"

type Props = {
  open: boolean
  title: string
  /** Beside the title and outside it, so the dialog's name stays the title: a record's copy button. */
  titleAside?: ReactNode
  children: ReactNode
  /** The dialog's choices. Left out when there is nothing to choose: the × closes it. */
  actions?: ReactNode
  onClose: () => void
  /** Asked before ×, Escape or a click outside closes it; false keeps it open. The browser's own close is not asked. */
  canClose?: () => boolean
  /** `xl` for an editor with a side column, such as a task's; `full` for a board of columns. */
  wide?: boolean | "xl" | "full"
  /** Long forms: the body scrolls between a fixed title and fixed actions, so nothing is cut off. */
  scroll?: boolean
  /** With `scroll`: one height whatever the content, so a save or the next record moves nothing, the frame included. */
  tall?: boolean
  /** Quiet links under the actions, for what the reader rarely needs. */
  footer?: ReactNode
}

/**
 * The platform's modal <dialog>: focus is trapped, and Escape, the × or a click outside closes it. Focus goes back to
 * what opened it, unless something else took it meanwhile (another dialog opened from this one).
 */
export function Dialog({
  open,
  title,
  titleAside,
  children,
  actions,
  onClose,
  canClose,
  wide = false,
  scroll = false,
  tall = false,
  footer,
}: Props) {
  const m = useMessages(uiMessages)
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  // A press that starts inside (selecting text in a field) and ends on the backdrop is not a click outside.
  const pressedOutside = useRef(false)
  const titleId = useId()
  const aside = useRef<HTMLSpanElement>(null)
  const requestClose = () => {
    if (canClose?.() !== false) onClose()
  }
  // The content stays while the dialog fades out, so it does not go blank before it goes away.
  const [closing, setClosing] = useState(false)
  const last = useRef({ title, titleAside, children, actions, footer })
  if (open) last.current = { title, titleAside, children, actions, footer }

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const finish = () => {
      d.close()
      const now = document.activeElement
      if (opener.current?.isConnected && (!now || now === document.body || d.contains(now))) opener.current.focus()
      opener.current = null
    }
    if (open) {
      setClosing(false)
      if (!d.open) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        d.showModal?.()
        // showModal focuses the first focusable thing, which can be a scrolling area rather than the first field.
        // Nor the copy button beside the title: the dialog starts on its content.
        const first = d.querySelector<HTMLElement>("[data-autofocus]")
        if (first) first.focus()
        else if (aside.current?.contains(document.activeElement))
          [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => !aside.current?.contains(el))?.focus()
      }
      return
    }
    if (!d.open) return
    if (reducedMotion()) {
      finish()
      return
    }
    setClosing(true)
    const t = setTimeout(() => {
      finish()
      setClosing(false)
    }, CLOSE_MS)
    return () => clearTimeout(t)
  }, [open])

  const shown = open ? { title, titleAside, children, actions, footer } : last.current

  // Last in the DOM, so showModal's first focus lands on the dialog's own content, not on the ×.
  const close = (
    <button
      type="button"
      aria-label={m.closeDialog}
      title={m.closeDialog}
      onClick={requestClose}
      // A dialog with nothing to choose starts on its way out; a field or a choice marked data-autofocus comes first.
      data-autofocus={shown.actions ? undefined : true}
      className="absolute top-[1.1rem] right-[1.1rem] grid size-[2.1rem] place-items-center rounded-button text-ink-dim transition-colors duration-(--motion-fast) hover:bg-app-3 hover:text-ink"
    >
      <X className="size-[1.15rem]" strokeWidth={1.8} aria-hidden />
    </button>
  )

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-closing={closing || undefined}
      aria-hidden={closing || undefined}
      inert={closing || undefined}
      // React passes a dialog's close and cancel up to a dialog that holds it (an image enlarged from a sign-in).
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        requestClose()
      }}
      // Chromium stops honouring preventDefault on a repeated cancel, so a dialog that may refuse takes Escape first.
      onKeyDown={(e) => {
        if (!canClose || e.key !== "Escape" || e.defaultPrevented) return
        e.preventDefault()
        requestClose()
      }}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) requestClose()
        pressedOutside.current = false
      }}
      className={`m-auto ${wide === "full" ? "w-[min(112rem,calc(100vw-2rem))]" : wide === "xl" ? "w-[min(62rem,calc(100vw-2rem))]" : wide ? "w-[min(46rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"} ${scroll ? "max-h-[calc(100vh-2rem)] overflow-hidden" : ""} rounded-dialog border border-line bg-app p-0 text-ink shadow-panel backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
    >
      {(open || closing) &&
        (scroll ? (
          // The dialog's border sits inside its max height, so the column is 2px shorter or the dialog scrolls too.
          <div
            className={cx(
              "relative flex max-h-[calc(100vh-2rem-2px)] flex-col",
              tall && "h-[min(50rem,calc(100vh-2rem-2px))]",
            )}
          >
            <div className="flex shrink-0 items-center gap-1 px-6 pt-6 pr-16 pb-3">
              <h2 id={titleId} className="min-w-0 text-[1.2rem] font-semibold">
                {shown.title}
              </h2>
              {shown.titleAside && (
                <span ref={aside} className="shrink-0">
                  {shown.titleAside}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-1 text-[0.95rem] leading-relaxed text-ink-soft">
              {shown.children}
            </div>
            {shown.actions && (
              <div className="flex shrink-0 justify-end gap-2 border-line border-t px-6 pt-4 pb-5">{shown.actions}</div>
            )}
            {shown.footer && (
              <div className={cx("shrink-0 px-6 pb-5", !shown.actions && "border-line border-t pt-4")}>
                {shown.footer}
              </div>
            )}
            {!shown.actions && !shown.footer && <div className="h-5 shrink-0" />}
            {close}
          </div>
        ) : (
          <div className="relative flex flex-col gap-4 p-6">
            <div className="flex items-center gap-1 pr-10">
              <h2 id={titleId} className="min-w-0 text-[1.2rem] font-semibold">
                {shown.title}
              </h2>
              {shown.titleAside && (
                <span ref={aside} className="shrink-0">
                  {shown.titleAside}
                </span>
              )}
            </div>
            <div className="text-[0.95rem] leading-relaxed text-ink-soft">{shown.children}</div>
            {shown.actions && <div className="mt-2 flex justify-end gap-2">{shown.actions}</div>}
            {shown.footer}
            {close}
          </div>
        ))}
    </dialog>
  )
}
