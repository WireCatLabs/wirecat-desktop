import { Plus } from "lucide-react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { Button } from "@/ui/Button"
import { ownMessages } from "./messages-own"

/**
 * Always under the tool list, so an owner looking for how to add a tool finds it. While "Allow tools WireCat has not
 * checked" is off, a @wirecat package is read at once; any other name gets that setting's warning, which turns it on.
 */
export function AddOwnTool() {
  const m = useMessages(ownMessages)
  const open = async () => {
    const status = await platform.ownToolsStatus().catch(() => null)
    useOwnDialog.getState().show(null, null, !(status?.allowed || status?.flag))
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-rack border border-dashed border-line-strong px-4 py-3">
      <p className="min-w-0 flex-1 text-[0.92rem] text-ink-soft">{m.addHint}</p>
      <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => void open()}>
        {m.open}
      </Button>
    </div>
  )
}
