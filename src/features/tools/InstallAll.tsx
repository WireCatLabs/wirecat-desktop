import { useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { type CatalogTool, isCommunity, isOwn, tools } from "@/domain/catalog"
import { listBlocksInstalls } from "@/domain/community-list"
import { toolStatus } from "@/domain/status"
import { useMessages } from "@/i18n"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { focusInPlace } from "@/ui/motion"
import { StableText } from "@/ui/Skeleton"
import { toolsMessages } from "./messages"
import { useRegistry } from "./registry-store"

type Tools = ReturnType<typeof useTools.getState>

const idle = (s: Tools, id: string) => !s.sessions[id] || Boolean(s.sessions[id]?.outcome)

// Community and own tools stay out: their rows show a trust note or open a review before they install.
const missingOf = (s: Tools) =>
  s.checked
    ? tools
        .filter((t) => !isCommunity(t) && !isOwn(t) && !t.partOf)
        .filter((t) => s.installs[t.id]?.length === 0 && idle(s, t.id))
        .map((t) => t.id)
    : []

// An own tool updates only through its review, one at a time, so it is left out; a listed community tool was
// accepted when it was installed, and updates like ours while the signed list allows installs.
const updatable = (t: CatalogTool, listBlocks: boolean) => !t.partOf && !isOwn(t) && !(isCommunity(t) && listBlocks)

const outdatedOf = (listBlocks: boolean) => (s: Tools) =>
  s.checked && s.latest
    ? tools
        .filter((t) => updatable(t, listBlocks) && idle(s, t.id))
        .filter((t) => toolStatus(s.installs[t.id], s.latest?.[t.id] ?? null).kind === "outdated")
        .map((t) => t.id)
    : []

/**
 * Installs every WireCat tool not on this computer yet, and updates every installed one with a newer version; the
 * store queues them, so npm runs one at a time. A failed one opens its own row's panel.
 */
export function InstallAll() {
  const m = useMessages(toolsMessages).page
  const listBlocks = useRegistry((s) => listBlocksInstalls(s.status))
  const missing = useTools(useShallow(missingOf))
  const outdated = useTools(useShallow(outdatedOf(listBlocks)))
  const install = useBatch(missing)
  const update = useBatch(outdated)
  const installShown = install.busy || missing.length > 0
  const updateShown = update.busy || outdated.length > 0
  return (
    <Crossfade
      swap={installShown || updateShown ? `${installShown}-${updateShown}` : "none"}
      align="end"
      className="ml-auto shrink-0"
    >
      {(installShown || updateShown) && (
        <span className="flex items-center gap-2">
          {updateShown && (
            <Button size="sm" variant="secondary" busy={update.busy} onClick={update.start}>
              <StableText
                value={update.busy ? m.updatingAll : m.updateAll(outdated.length)}
                variants={[m.updatingAll, m.updateAll(outdated.length)]}
              />
            </Button>
          )}
          {installShown && (
            <Button size="sm" busy={install.busy} onClick={install.start}>
              <StableText
                value={install.busy ? m.installingAll : m.installAll(missing.length)}
                variants={[m.installingAll, m.installAll(missing.length)]}
              />
            </Button>
          )}
        </span>
      )}
    </Crossfade>
  )
}

function useBatch(ids: readonly string[]) {
  const [started, setStarted] = useState<readonly string[]>([])
  const busy = useTools((s) =>
    started.some((id) => {
      const session = s.sessions[id]
      return session && !session.outcome && session.step !== "preflight"
    }),
  )
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const start = () => {
    if (!nodeReady) return focusInPlace(document.querySelector<HTMLElement>("[data-node-notice]"))
    setStarted(ids)
    for (const id of ids) useTools.getState().install(id, { check: true, shut: true })
  }
  return { busy, start }
}
