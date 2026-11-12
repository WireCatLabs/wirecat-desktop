import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { type CatalogTool, removeCommand } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { CopyRemoval, ToolState } from "@/platform/schemas"
import { errorText } from "@/shared/errors"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { copiesMessages } from "./messages-copies"

export type Copy = ToolState["installs"][number]

/** The managers `remove_copy` acts for; any other copy keeps only its command to run by hand. */
export const removable = (copy: Copy) => copy.manager === "npm" || copy.manager === "pnpm"

type Phase = { step: "confirm" } | { step: "running" } | { step: "result"; result: CopyRemoval }

/**
 * Removes one unused copy with the program that installed it (`remove_copy` in Rust). It lives above the copies list:
 * once the copy is gone that list goes too, and the dialog must stay to say how it went.
 */
export function RemoveCopyDialog(props: { tool: CatalogTool; copy: Copy | null; onClose: () => void }) {
  const { tool, copy, onClose } = props
  const m = useMessages(copiesMessages)
  const installs = useTools((s) => s.installs[tool.id]) ?? []
  const [phase, setPhase] = useState<Phase>({ step: "confirm" })
  const [shown, setShown] = useState<Copy | null>(copy)
  const [opened, setOpened] = useState<Copy | null>(null)
  const [showLog, setShowLog] = useState(false)
  // Each opening starts at the question; the last copy stays shown while the dialog fades out.
  if (copy !== opened) {
    setOpened(copy)
    if (copy) {
      setShown(copy)
      setPhase({ step: "confirm" })
      setShowLog(false)
    }
  }
  const target = copy ?? shown
  if (!target) return null

  const command = removeCommand(target.manager, tool.package, target.path)
  const path = <code className="selectable break-all font-mono text-ink">{target.path}</code>
  const close = () => {
    if (phase.step !== "running") onClose()
  }
  const run = async () => {
    setPhase({ step: "running" })
    let result: CopyRemoval
    try {
      result = await platform.removeCopy(tool.id, target.path)
    } catch (e) {
      const message = errorText(e)
      result = { removed: false, refused: null, log: [], message, hint: null }
    }
    setPhase({ step: "result", result })
    await useTools.getState().refresh(true)
  }
  const result = phase.step === "result" ? phase.result : null
  const left = result?.removed && installs.length === 1 ? installs[0] : null

  return (
    <Dialog
      open={copy !== null}
      title={m.title}
      onClose={close}
      actions={
        phase.step === "confirm" ? (
          <>
            <Button variant="secondary" onClick={onClose} data-autofocus>
              {m.keep}
            </Button>
            <Button variant="danger" onClick={run}>
              {m.remove}
            </Button>
          </>
        ) : phase.step === "running" ? (
          <Button variant="danger" aria-disabled onClick={() => undefined}>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {m.removing}
          </Button>
        ) : result?.removed ? (
          <Button variant="primary" onClick={onClose} autoFocus>
            {m.done}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {m.close}
            </Button>
            <Button variant="secondary" onClick={run} autoFocus>
              {m.tryAgain}
            </Button>
          </>
        )
      }
    >
      <div aria-live="polite" className="flex flex-col gap-3">
        {result?.removed ? (
          <p className="flex items-start gap-2 text-ink">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            <span>
              {m.removed(path)}
              <Collapse open={left !== null}>
                <span className="mt-1 block text-ink-soft">
                  {left && m.onlyOne(<code className="selectable break-all font-mono">{left.path}</code>)}
                </span>
              </Collapse>
            </span>
          </p>
        ) : result ? (
          <>
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
              <span>
                <span className="font-medium text-ink">{m.failed}</span>{" "}
                {result.refused ? m.refused[result.refused] : [result.message, result.hint].filter(Boolean).join(" ")}
              </span>
            </p>
            <p className="text-ink-soft">{m.byHand}</p>
            <CopyField value={command} label={command} wrap />
          </>
        ) : (
          <>
            <p>{m.removes(path, target.version ?? "?", target.manager)}</p>
            <p className="text-ink-soft">{m.runs}</p>
            <code className="selectable block break-all rounded-[0.4rem] border border-line bg-app-2 px-3 py-2 font-mono text-[0.9rem] text-ink">
              {command}
            </code>
          </>
        )}
        {result && result.log.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              aria-expanded={showLog}
              className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover"
            >
              {showLog ? m.hideLog : m.showLog}
              <ExpandChevron open={showLog} className="text-current" />
            </button>
            <Collapse open={showLog}>
              <pre
                role="log"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1)
                tabIndex={0}
                aria-label={m.log}
                className="selectable mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-[0.4rem] border border-line bg-app p-3 font-mono text-[0.85rem] leading-relaxed text-ink-soft [overflow-wrap:anywhere]"
              >
                {result.log.join("\n")}
              </pre>
            </Collapse>
          </div>
        )}
      </div>
    </Dialog>
  )
}
