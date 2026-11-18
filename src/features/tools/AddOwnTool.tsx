import { Plus } from "lucide-react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { Button } from "@/ui/Button"
import { ownMessages } from "./messages-own"

/**
 * Above the tool list, beside "Install all", so an owner looking for how to add a tool finds it. While "Allow tools
 * WireCat has not checked" is off, a @wirecat package is read at once; any other name gets that setting's warning,
 * which turns it on.
 */
export function AddOwnTool() {
  const m = useMessages(ownMessages)
  const open = async () => {
    const status = await platform.ownToolsStatus().catch(() => null)
    useOwnDialog.getState().show(null, null, !(status?.allowed || status?.flag))
  }
  return (
    <Button
      variant="primary"
      size="sm"
      className="shrink-0"
      title={m.addHint}
      icon={<Plus className="size-4" aria-hidden />}
      onClick={() => void open()}
    >
      {m.open}
    </Button>
  )
}
