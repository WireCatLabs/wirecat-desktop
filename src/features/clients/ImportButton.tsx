import { useQueries } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { type CatalogTool, tools } from "@/domain/catalog"
import { SyncStatus, syncKey, useSync, useSyncControl } from "@/features/tools"
import { useMessages } from "@/i18n"
import { profilesQuery } from "@/shared/query"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { SplitButton } from "@/ui/SplitButton"
import { tableMessages } from "./messages-table"

type Pair = { tool: CatalogTool; profile: string }

/** Every installed CRM tool with each profile signed in to it; the owner picks one, the page never does (rule 3). */
export function useImportPairs(): Pair[] {
  const installs = useTools((s) => s.installs)
  const crms = tools.filter((t) => t.crm && (installs[t.id]?.length ?? 0) > 0)
  const profiles = useQueries({ queries: crms.map((t) => profilesQuery(t.id)) })
  return crms.flatMap((tool, i) =>
    (profiles[i]?.data ?? []).filter((p) => p.signedIn !== false).map((p) => ({ tool, profile: p.name })),
  )
}

/**
 * Import is the CRM tool's own sync of one profile, the one the Tools page runs. One pair is a plain button, several a
 * menu with no default; with none, the page's CRM notice offers the install or the sign-in instead.
 */
export function ImportButton() {
  const t = useMessages(tableMessages)
  const pairs = useImportPairs()
  const runs = useSync((s) => s.runs)
  const running = pairs.find((p) => runs[syncKey(p.tool.id, p.profile)]?.phase === "running")
  const start = (p: Pair) => useSync.getState().start(p.tool.id, p.profile)
  const icon = <Download className="size-4" aria-hidden />
  const [only] = pairs
  if (!only) return null
  return (
    <div className="flex min-w-0 items-center gap-3">
      {running && <Running pair={running} />}
      {pairs.length === 1 ? (
        <Button size="sm" variant="secondary" icon={icon} disabled={!!running} onClick={() => start(only)}>
          {running ? t.importing(only.tool.name) : t.import(only.tool.name)}
        </Button>
      ) : (
        <SplitButton
          items={pairs.map((p) => ({ label: t.importAs(p.tool.name, p.profile), onSelect: () => start(p) }))}
          menuLabel={t.importMenu}
          moreLabel={running ? t.importing(running.tool.name) : t.importMenu}
          disabled={!!running}
        />
      )}
    </div>
  )
}

function Running({ pair }: { pair: Pair }) {
  const c = useSyncControl(pair.tool, pair.profile)
  return (
    <div className="w-[16rem] max-w-full">
      <SyncStatus c={c} />
    </div>
  )
}
