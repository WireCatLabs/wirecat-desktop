import { findTool } from "@/domain/catalog"
import { reasonOf, tooOldFor } from "@/domain/memory-add"
import { ToolNeeded } from "@/features/tools"
import { useMessages } from "@/i18n"
import { ReportThis } from "@/shared/ReportThis"
import { useTools } from "@/shared/tools-store"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { GoAiModel } from "./AddImageLine"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

const AI_MODEL_REASONS: string[] = ["reader.no-key", "reader.ai-not-set"]

/**
 * The step's last refusal: memo's reasons in the owner's words, anything else in memo's own. A memo that does not know
 * the command is too old, which the page says as every page does.
 */
export function Refusal() {
  const m = useMessages(addMessages)
  const error = useAddSource((s) => s.error)
  const version = useTools((s) => s.installs.memo?.[0]?.version ?? null)
  const need = findTool("memo")?.memory?.minVersion
  const reason = error ? reasonOf(error) : null
  const old = error !== null && !reason && tooOldFor(error) && need
  return (
    <Collapse open={error !== null}>
      {old ? (
        <ToolNeeded inline gap={{ kind: "old", tool: "memo", version, need }} />
      ) : (
        error && (
          <ErrorNotice
            inline
            action={
              !reason ? (
                <ReportThis what="Adding to memory" error={error} />
              ) : AI_MODEL_REASONS.includes(reason) ? (
                <GoAiModel />
              ) : undefined
            }
          >
            {reason ? m.reasons[reason] : `${m.failed} ${error}`}
          </ErrorNotice>
        )
      )}
    </Collapse>
  )
}
