import { X } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { reducedMotion } from "./motion"

const CLOSE_MS = 150

type Props = {
  open: boolean
  title: string
  children: ReactNode
  /** The dialog's choices. Left out when there is nothing to choose: the × closes it. */
  actions?: ReactNode
  onClose: () => void
  /** `xl` for an editor with a side column, such as a task's. */
  wide?: boolean | "xl"
  /** Long forms: the body scrolls between a fixed title and fixed actions, so nothing is cut off. */
  scroll?: boolean
  /** Quiet links under the actions, for what the reader rarely needs. */
  footer?: ReactNode
}

/**
 * The platform's modal <dialog>: focus is trapped, and Escape, the × or a click outside closes it. Focus goes back to
 * what opened it, unless something else took it meanwhile (another dialog opened from this one).
 */
export function Dialog({ open, title, children, actions, onClose, wide = false, scroll = false, footer }: Props) {
  const m = useMessages(uiMessages)
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  // A press that starts inside (selecting text in a field) and ends on the backdrop is not a click outside.
  const pressedOutside = useRef(false)
  const titleId = useId()
  // The content stays while the dialog fades out, so it does not go blank before it goes away.
  const [closing, setClosing] = useState(false)
  const last = useRef({ title, children, actions, footer })
  if (open) last.current = { title, children, actions, footer }

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
        d.querySelector<HTMLElement>("[data-autofocus]")?.focus()
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

  const shown = open ? { title, children, actions, footer } : last.current

  // Last in the DOM, so showModal's first focus lands on the dialog's own content, not on the ×.
  const close = (
    <button
      type="button"
      aria-label={m.closeDialog}
      title={m.closeDialog}
      onClick={onClose}
      // A dialog with nothing to choose starts on its way out; a field or a choice marked data-autofocus comes first.
      data-autofocus={shown.actions ? undefined : true}
      className="absolute top-[1.1rem] right-[1.1rem] grid size-[2.1rem] place-items-center rounded-[0.4rem] text-ink-dim transition-colors duration-150 hover:bg-app-3 hover:text-ink"
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
        onClose()
      }}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) onClose()
        pressedOutside.current = false
      }}
      className={`m-auto ${wide === "xl" ? "w-[min(62rem,calc(100vw-2rem))]" : wide ? "w-[min(46rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"} ${scroll ? "max-h-[calc(100vh-2rem)] overflow-hidden" : ""} rounded-[0.6rem] border border-line bg-app p-0 text-ink shadow-panel backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
    >
      {(open || closing) &&
        (scroll ? (
          // The dialog's border sits inside its max height, so the column is 2px shorter or the dialog scrolls too.
          <div className="relative flex max-h-[calc(100vh-2rem-2px)] flex-col">
            <h2 id={titleId} className="shrink-0 px-6 pt-6 pr-16 pb-3 text-[1.2rem] font-semibold">
              {shown.title}
            </h2>
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
            <h2 id={titleId} className="pr-10 text-[1.2rem] font-semibold">
              {shown.title}
            </h2>
            <div className="text-[0.95rem] leading-relaxed text-ink-soft">{shown.children}</div>
            {shown.actions && <div className="mt-2 flex justify-end gap-2">{shown.actions}</div>}
            {shown.footer}
            {close}
          </div>
        ))}
    </dialog>
  )
}
