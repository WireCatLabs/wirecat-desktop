import { X } from "lucide-react"
import { useMessages } from "@/i18n"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ownMessages } from "./messages-own"

/** Where the removed tool's row was: what happened and what is left on the computer. */
export function OwnRemoved() {
  const m = useMessages(ownMessages)
  const removed = useOwnDialog((s) => s.removed)
  return (
    <Collapse open={removed !== null}>
      {removed && (
        <div className="flex items-start gap-3 rounded-[0.35rem] border border-line-strong bg-app-2 px-3.5 py-2.5 text-[0.95rem]">
          <p role="status" className="selectable min-w-0 flex-1">
            {removed.installed ? m.removedInstalled(removed.name, removed.pkg) : m.removedGone(removed.name)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            aria-label={m.dismiss}
            onClick={() => useOwnDialog.getState().removedOne(null)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </Collapse>
  )
}
