import { CheckCircle2, Play } from "lucide-react"
import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Background } from "@/platform/sync-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { StableText } from "@/ui/Skeleton"
import { syncMessages } from "./messages-sync"

type Phase = { kind: "idle" } | { kind: "starting" } | { kind: "kept" } | { kind: "failed"; message: string }

/**
 * A quiet line under a messenger profile when its own `serve` is not running, so the archive only grows on a sync.
 * Nothing shows while it runs or while the tool cannot say. The action is the tool's own `server install` and
 * `server start`; the line stays to say it worked.
 */
export function BackgroundLine({ tool, profile }: { tool: CatalogTool; profile: string }) {
  const m = useMessages(syncMessages).background
  const [state, setState] = useState<Background | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  useEffect(() => {
    let live = true
    platform.backgroundStatus(tool.id, profile).then(
      (s) => live && setState(s),
      () => live && setState({ state: "unknown" }),
    )
    return () => {
      live = false
    }
  }, [tool.id, profile])

  const keep = () => {
    setPhase({ kind: "starting" })
    platform.backgroundKeep(tool.id, profile).then(
      (s) => {
        setState(s)
        setPhase(s.state === "running" ? { kind: "kept" } : { kind: "idle" })
      },
      (e) => setPhase({ kind: "failed", message: e instanceof Error ? e.message : String(e) }),
    )
  }

  const open = state?.state === "stopped" || phase.kind === "kept"
  const starting = phase.kind === "starting"
  return (
    <Collapse open={open}>
      <section aria-label={m.region(`${tool.name} ${profile}`)} aria-live="polite" className="pt-0.5">
        <AutoHeight swap={phase.kind === "kept" ? "kept" : "stopped"}>
          {phase.kind === "kept" ? (
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
                  onClick={() => !starting && keep()}
                  aria-busy={starting || undefined}
                  icon={<Play className="size-4" aria-hidden />}
                >
                  <StableText value={starting ? m.starting : m.keep} variants={[m.keep, m.starting]} />
                </Button>
              </div>
              <Collapse open={phase.kind === "failed"}>
                <ErrorNotice inline>{phase.kind === "failed" ? m.failed(phase.message) : null}</ErrorNotice>
              </Collapse>
            </div>
          )}
        </AutoHeight>
      </section>
    </Collapse>
  )
}
