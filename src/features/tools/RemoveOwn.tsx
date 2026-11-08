import { Trash2 } from "lucide-react"
import { useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { reloadAddedTools } from "@/shared/added-tools"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ownMessages } from "./messages-own"

/**
 * Deletes the saved entry; the tool leaves the list at once. Uninstall is offered first, while the tool is still in
 * the catalog, because the existing flow (`onUninstall`) resolves it there and limits data deletion to its own folders.
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
  const [error, setError] = useState<string | null>(null)
  const remove = () => {
    setAsking(false)
    setError(null)
    platform.ownToolRemove(tool.id).then(
      async () => {
        useOwnDialog.getState().removedOne({ name: tool.name, pkg: tool.package, installed })
        await reloadAddedTools()
        void useTools.getState().refresh(true)
      },
      (e) => setError(String(e)),
    )
  }
  return (
    <div className="flex flex-col gap-3">
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
            {installed && (
              <Button
                variant="secondary"
                onClick={() => {
                  setAsking(false)
                  onUninstall()
                }}
              >
                {m.uninstallFirst}
              </Button>
            )}
            <Button variant="danger" onClick={remove}>
              {m.remove}
            </Button>
          </>
        }
      >
        <p className="text-[0.95rem]">{installed ? m.removeBody : m.removeBodyGone}</p>
      </Dialog>
    </div>
  )
}
