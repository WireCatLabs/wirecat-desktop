import { tools } from "@/domain/catalog"
import { needsUpdate, type SkillTarget, skillCell, skillColumns } from "@/domain/skills"
import { isNewer } from "@/domain/status"
import { cellKey, useAgents } from "@/shared/agents-store"
import { useTools } from "@/shared/tools-store"

// A part of another tool's package (Email in memo) has no skill of its own; its owner's skill covers it.
export const catalogTools = tools.filter((t) => t.skill !== null)

/** Each installed tool's skill in each folder agents read, for the Agents page and onboarding's matrix. */
export function useSkillMatrix() {
  const installs = useTools((s) => s.installs)
  const latest = useTools((s) => s.latest)
  const latestOf = (id: string, current: string | null) => {
    const l = latest?.[id]
    return l && current && isNewer(l, current) ? l : null
  }
  const { agents, skills, written, busy, failures } = useAgents()
  const detected = Object.keys(installs).length > 0
  const installed = catalogTools.filter((t) => (installs[t.id]?.length ?? 0) > 0)
  const found = agents?.filter((a) => a.foundBy !== null) ?? null
  const columns = skillColumns(agents)
  const targets = columns.map((c) => c.target)
  const rows = installed.map((tool) => {
    const cliVersion = installs[tool.id]?.[0]?.version ?? null
    const skill = skills[tool.id]
    return {
      tool,
      cliVersion,
      source: skill?.report?.source ?? null,
      newer: latestOf(tool.id, cliVersion),
      cells: targets.map((target) => {
        const key = cellKey(tool.id, target)
        return {
          target,
          busy: busy[key] === true,
          failure: failures[key] ?? null,
          cell: skillCell({
            target,
            cliVersion,
            report: skill?.report,
            error: skill?.error,
            written: written[key],
          }),
        }
      }),
    }
  })
  const stale: [string, SkillTarget][] = rows.flatMap((r) =>
    r.cells.filter((c) => needsUpdate(c.cell) && !c.busy).map((c): [string, SkillTarget] => [r.tool.id, c.target]),
  )
  return {
    detected,
    agents,
    found,
    columns,
    targets,
    rows,
    stale,
    notInstalled: catalogTools.filter((t) => !installed.includes(t)),
  }
}
