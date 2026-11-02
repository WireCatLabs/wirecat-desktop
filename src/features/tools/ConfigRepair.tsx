import { FolderOpen, LoaderCircle, Wrench } from "lucide-react"
import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import type { Finding } from "@/domain/doctor"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Repair } from "@/platform/repair-schemas"
import { Button } from "@/ui/Button"
import { ReportThis } from "../report/ReportThis"
import { toolsMessages } from "./messages"

export type Repaired = Extract<Repair, { state: "repaired" }>
type Refused = Extract<Repair, { state: "refused" }>

// One `commands --json` per tool and profile while the window is open; an update reloads the window's tool state.
const known = new Map<string, Promise<boolean>>()
export const forgetRepairSupport = () => known.clear()

function useRepairable(tool: CatalogTool, profile: string | null): boolean {
  const [yes, setYes] = useState(false)
  useEffect(() => {
    if (!tool.configRepair) return
    let live = true
    const key = `${tool.id}/${profile ?? ""}`
    let asked = known.get(key)
    if (!asked) {
      asked = platform.configRepairSupported(tool.id, profile).catch(() => false)
      known.set(key, asked)
    }
    asked.then((v) => live && setYes(v))
    return () => {
      live = false
    }
  }, [tool, profile])
  return yes
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path

/**
 * A settings file that is not valid JSON, handed to the tool's own `config repair` (rule 1): it fixes what it can prove
 * safe after a backup, or refuses. Shown only when the installed version has the command.
 */
export function ConfigRepair(props: {
  tool: CatalogTool
  finding: Finding
  profile: string | null
  onRepaired: (r: Repaired) => void
}) {
  const { tool, finding, profile, onRepaired } = props
  const m = useMessages(toolsMessages).health
  const repairable = useRepairable(tool, profile)
  const [running, setRunning] = useState(false)
  const [refused, setRefused] = useState<Refused | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!repairable || finding.config?.kind !== "invalid_json") return null

  const repair = async () => {
    if (running) return
    setRunning(true)
    setRefused(null)
    setError(null)
    try {
      const r = await platform.configRepair(tool.id, profile)
      if (r.state === "repaired") onRepaired(r)
      else setRefused(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }
  const file = refused?.file ?? finding.config.file ?? null
  const line = refused?.line ?? finding.config.line ?? null
  const reveal = async () => {
    try {
      // The folder opens with the file selected; the file itself never opens in whatever app claims .json.
      await platform.openFolder(tool.id, "config", file ? fileName(file) : undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          size="sm"
          onClick={repair}
          icon={
            running ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Wrench className="size-4" aria-hidden />
            )
          }
        >
          {running ? m.repairing : m.repair}
        </Button>
      </div>
      {refused && (
        <div role="status" className="reveal flex flex-col gap-1.5 text-[0.875rem] text-ink-soft">
          <p>
            {m.repairRefused(tool.name)} {refused.message}
          </p>
          {file && (
            <code className="selectable font-mono text-[0.85rem] break-all">
              {line === null ? file : `${file}:${line}`}
            </code>
          )}
          <p>{m.repairByHand}</p>
          <div>
            <Button size="sm" variant="ghost" onClick={reveal} icon={<FolderOpen className="size-4" aria-hidden />}>
              {m.showFile}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-ink-soft">
          <span className="min-w-0 flex-1">
            {m.repairFailed} {error}
          </span>
          <ReportThis what={`Repairing the ${tool.name} settings file`} tool={tool.id} error={error} />
        </div>
      )}
    </div>
  )
}
