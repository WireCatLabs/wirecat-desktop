import { RotateCw, Trash2 } from "lucide-react"
import { useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ownMessages } from "./messages-own"

/**
 * Deletes the saved entry only. Uninstall stays the existing flow (`onUninstall`), whose data deletion is limited to
 * the tool's own folders in Rust and never reaches the shared store.
 */
export function RemoveOwn({
  tool,
  installed,
  onUninstall,
}: {
  tool: CatalogTool
  installed: boolean
  onUninstall(): void
}) {
  const m = useMessages(ownMessages)
  const [asking, setAsking] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = () => {
    setAsking(false)
    setError(null)
    platform.ownToolRemove(tool.id).then(
      () => setRemoved(true),
      (e) => setError(String(e)),
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {!removed && (
        <div>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-4" aria-hidden />}
            onClick={() => setAsking(true)}
          >
            {m.remove}
          </Button>
        </div>
      )}
      <Collapse open={removed} className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-[0.95rem]">
          {m.removed(tool.name)}
        </p>
        {installed && (
          <Button size="sm" variant="danger" onClick={onUninstall}>
            {m.uninstallToo}
          </Button>
        )}
        <Button size="sm" icon={<RotateCw className="size-4" aria-hidden />} onClick={() => platform.restart()}>
          {m.restart}
        </Button>
      </Collapse>
      <Collapse open={error !== null}>
        <ErrorNotice inline>{error}</ErrorNotice>
      </Collapse>
      <Dialog
        open={asking}
        title={m.removeTitle(tool.name)}
        onClose={() => setAsking(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {m.cancel}
            </Button>
            <Button variant="danger" onClick={remove}>
              {m.remove}
            </Button>
          </>
        }
      >
        <p className="text-[0.95rem]">{m.removeBody}</p>
      </Dialog>
    </div>
  )
}
