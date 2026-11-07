import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { ownMessages } from "./messages-own"

/** Shown only while "Allow tools WireCat has not checked" is on (or the developer flag is set). */
export function AddOwnTool({ className }: { className: string }) {
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
    <button type="button" className={className} onClick={() => useOwnDialog.getState().show()}>
      <Plus className="size-4" aria-hidden />
      {m.open}
    </button>
  )
}
