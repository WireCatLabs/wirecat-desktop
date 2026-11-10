import { type ReactNode, useCallback, useState } from "react"
import { Collapse } from "./Collapse"

/**
 * What a form does when its button is pressed with a value missing: show the error at the field, mark the field and put
 * focus in it. The button itself is never disabled for this. The error clears when the user edits the field.
 */
export function useFieldError(id: string) {
  const [error, setError] = useState<string | null>(null)
  const fail = useCallback(
    (message: string) => {
      setError(message)
      const el = document.getElementById(id)
      // A group (fieldset) takes focus in its first control that can take it.
      const usable = "input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)"
      ;(el?.matches(usable) ? el : el?.querySelector<HTMLElement>(usable))?.focus()
    },
    [id],
  )
  const clear = useCallback(() => setError(null), [])
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
