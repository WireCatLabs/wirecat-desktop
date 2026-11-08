import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { type OpenFailure, onOpenUrlFailure } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { appMessages } from "./messages"

/** A link the system could not open, wherever it was clicked: its address to copy, and the system's reason. */
export function LinkFailure() {
  const m = useMessages(appMessages).linkFailed
  const [failure, setFailure] = useState<OpenFailure | null>(null)
  useEffect(() => onOpenUrlFailure(setFailure), [])
  const close = () => setFailure(null)
  return (
    <Dialog
      open={failure !== null}
      title={m.title}
      onClose={close}
      actions={
        <Button variant="secondary" onClick={close} autoFocus>
          {m.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p>{m.body}</p>
        {failure && <CopyField value={failure.url} label={m.copy} wrap />}
        {failure?.error && <p className="selectable text-[0.9rem] text-ink-dim">{m.reason(failure.error)}</p>}
      </div>
    </Dialog>
  )
}
