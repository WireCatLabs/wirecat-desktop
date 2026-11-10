import { type ReactNode, useCallback, useEffect, useState } from "react"
import { type Lang, useLang } from "@/i18n"
import { Collapse } from "./Collapse"

export type FieldMessage = string | ((lang: Lang) => string)

type Options = {
  preventScroll?: boolean
  /**
   * The value's problem as it stands now, worked out on every render. Once a click has failed (or at once with
   * `early`, for a mistake worth saying while it is typed) the error follows the value: it changes with the problem
   * and goes when the value is fixed, until the next failed click. Such a field does not call `clear` on each edit.
   */
  live?: { problem: FieldMessage | null; early?: boolean }
}

/**
 * What a form does when its button is pressed with a value missing: show the error at the field, mark the field and put
 * focus in it. The button itself is never disabled for this. The error clears when the user edits the field.
 */
export function useFieldError(id: string, { preventScroll = false, live }: Options = {}) {
  const lang = useLang()
  // A function of the language, so a hint already on screen follows a language switch.
  const [said, setSaid] = useState<{ text: FieldMessage } | null>(null)
  const [tried, setTried] = useState(false)
  const [asked, setAsked] = useState(0)
  const fixed = live !== undefined && live.problem === null
  // A fixed value ends the failed click: a later problem, such as an unchanged draft after a good save, waits for the next.
  useEffect(() => {
    if (fixed) setTried(false)
  }, [fixed])
  const now = live && live.problem !== null && (tried || live.early) ? live.problem : null
  const shown = now ?? said?.text ?? null
  const error = shown === null ? null : typeof shown === "string" ? shown : shown(lang)
  /** Without a message, a live field says its current problem. */
  const fail = useCallback((message?: FieldMessage) => {
    if (message !== undefined) setSaid({ text: message })
    setTried(true)
    setAsked((n) => n + 1)
  }, [])
  // After the render that marks the field, so a group can hand focus to the control it marked.
  useEffect(() => {
    if (asked === 0) return
    const el = document.getElementById(id)
    const usable = "input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)"
    const target = el?.matches(usable)
      ? el
      : (el?.querySelector<HTMLElement>("[aria-invalid='true']") ?? el?.querySelector<HTMLElement>(usable))
    target?.focus({ preventScroll })
  }, [asked, id, preventScroll])
  const clear = useCallback(() => {
    setSaid(null)
    setTried(false)
  }, [])
  return {
    error,
    fail,
    clear,
    /** Spread on the field. */
    field: {
      "aria-invalid": error !== null || undefined,
      "aria-describedby": error !== null ? `${id}-error` : undefined,
    },
    /** Put under the field. */
    hint: <FieldError id={`${id}-error`}>{error}</FieldError>,
  }
}

export type FieldNeed = ReturnType<typeof useFieldError>

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Collapse open={Boolean(children)}>
      <p id={id} role="alert" className="selectable pt-1 text-[0.85rem] text-bad">
        {children}
      </p>
    </Collapse>
  )
}

/** The red border of a field with an error; the field's own class keeps the rest. */
export const invalidBorder = "aria-[invalid=true]:border-bad"
