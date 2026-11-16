import { useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { isCommunity, isOwn, tools } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { focusInPlace } from "@/ui/motion"
import { toolsMessages } from "./messages"

// Community and own tools stay out: their rows show a trust note or open a review before they install.
const missingOf = (s: ReturnType<typeof useTools.getState>) =>
  s.checked
    ? tools
        .filter((t) => !isCommunity(t) && !isOwn(t) && !t.partOf)
        .filter((t) => s.installs[t.id]?.length === 0 && (!s.sessions[t.id] || s.sessions[t.id]?.outcome))
        .map((t) => t.id)
    : []

/** Installs every WireCat tool not on this computer yet; the store queues them, so npm runs one at a time. */
export function InstallAll() {
  const m = useMessages(toolsMessages).page
  const missing = useTools(useShallow(missingOf))
  const [started, setStarted] = useState<readonly string[]>([])
  const busy = useTools((s) =>
    started.some((id) => {
      const session = s.sessions[id]
      return session && !session.outcome && session.step !== "preflight"
    }),
  )
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const shown = busy || missing.length > 0
  return (
    <Crossfade swap={shown ? "button" : "none"} align="end" className="ml-auto shrink-0">
      {shown && (
        <Button
          size="sm"
          busy={busy}
          onClick={() => {
            if (!nodeReady) return focusInPlace(document.querySelector<HTMLElement>("[data-node-notice]"))
            setStarted(missing)
            for (const id of missing) useTools.getState().install(id, { check: true })
          }}
        >
          {busy ? m.installingAll : m.installAll(missing.length)}
        </Button>
      )}
    </Crossfade>
  )
}
