import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { ownMessages } from "./messages-own"
import { useOwnDialog } from "./own-store"

/** Shown only while "Allow tools WireCat has not checked" is on (or the developer flag is set). */
export function AddOwnTool() {
  const m = useMessages(ownMessages)
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    platform.ownToolsStatus().then(
      (s) => setAllowed(s.allowed || s.flag),
      () => setAllowed(false),
    )
  }, [])
  if (!allowed) return null
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus className="size-4" aria-hidden />}
        onClick={() => useOwnDialog.getState().show()}
      >
        {m.open}
      </Button>
    </div>
  )
}
