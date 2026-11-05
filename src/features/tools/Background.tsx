import { CheckCircle2, Play } from "lucide-react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { StableText } from "@/ui/Skeleton"
import { useBackground, useKeepBackground } from "./api"
import { syncMessages } from "./messages-sync"

/**
 * A quiet line under a messenger profile when its own `serve` is not running, so the archive only grows on a sync.
 * Nothing shows while it runs or while the tool cannot say. The action is the tool's own `server install` and
 * `server start`; the line stays to say it worked.
 */
export function BackgroundLine({ tool, profile }: { tool: CatalogTool; profile: string }) {
  const m = useMessages(syncMessages).background
  const state = useBackground(tool.id, profile)
  const keep = useKeepBackground(tool.id, profile)
  const kept = keep.isSuccess && keep.data.state === "running"
  const failed = keep.error ? (keep.error instanceof Error ? keep.error.message : String(keep.error)) : null

  const open = state?.state === "stopped" || kept
  const starting = keep.isPending
  return (
    <Collapse open={open}>
      <section aria-label={m.region(`${tool.name} ${profile}`)} aria-live="polite" className="pt-0.5">
        <AutoHeight swap={kept ? "kept" : "stopped"}>
          {kept ? (
            <p className="flex items-start gap-2 text-[0.875rem] text-ink-soft">
              <CheckCircle2 className="mt-[0.15rem] size-4 shrink-0 text-ok" aria-hidden />
              <span>
                {m.kept(tool.name)} {m.keptDetail}
              </span>
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-[2.25rem] items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] text-ink-soft">{m.stopped}</p>
                  <p className="text-[0.8rem] text-ink-dim">{m.stoppedDetail(tool.name)}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => !starting && keep.mutate()}
                  aria-busy={starting || undefined}
                  icon={<Play className="size-4" aria-hidden />}
                >
                  <StableText value={starting ? m.starting : m.keep} variants={[m.keep, m.starting]} />
                </Button>
              </div>
              <Collapse open={failed !== null}>
                <ErrorNotice inline>{failed === null ? null : m.failed(failed)}</ErrorNotice>
              </Collapse>
            </div>
          )}
        </AutoHeight>
      </section>
    </Collapse>
  )
}
