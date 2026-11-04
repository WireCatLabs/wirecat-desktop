import { Check } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { cellAction, type SkillCell, type SkillTarget, TARGET_FOLDER } from "@/domain/skills"
import { formatList, type Lang, useMessages } from "@/i18n"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { FixButton, FixPanel } from "../fix/AgentFix"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { askSkillInstall, askToolSkills } from "./actions"
import { ConfirmCommand } from "./Confirm"
import { agentsMessages } from "./messages"
import { PathFixButton, PathFixResult } from "./PathFixResult"
import { usePathFix } from "./path-fix"
import { SKILL_TONE } from "./SkillTable"
import { catalogTools, useSkillMatrix } from "./skill-matrix"
import { useAgents } from "./store"

const names = (agents: readonly Agent[], lang?: Lang) =>
  formatList(
    agents.map((a) => a.name),
    lang,
  )

/**
 * Tools down, the two places a skill is written across, headed by the agents found that read each.
 * `compact` drops the folder paths and the list of agents, for embedding in onboarding.
 * `expected` names the tools to draw as rows while the installed ones are still being found.
 */
export function AgentsMatrix({ compact = false, expected = [] }: { compact?: boolean; expected?: readonly string[] }) {
  const matrix = useSkillMatrix()
  const m = useMessages(agentsMessages)
  const { detected, agents, found, notInstalled } = matrix
  // Hermes has its own target that no released tool writes yet; its pane on the Agents page says so. A column of
  // "needs a newer version" would only push the matrix past the onboarding step's width.
  const targets = matrix.targets.filter((t) => t !== "hermes")
  const rows = matrix.rows.map((r) => ({ ...r, cells: r.cells.filter((c) => c.target !== "hermes") }))
  const load = useAgents((s) => s.load)
  const installedIds = rows.map((r) => r.tool.id).join(",")
  const checked = useTools((s) => s.checked)

  useEffect(() => {
    const tools = useTools.getState()
    if (!checked && !tools.refreshing) tools.refresh()
  }, [checked])

  useEffect(() => {
    if (detected) load(installedIds ? installedIds.split(",") : [])
  }, [detected, installedIds, load])

  const readers = (target: SkillTarget) => matrix.columns.find((c) => c.target === target)?.readers ?? []
  const columnName = (target: SkillTarget, lang?: Lang) => names(readers(target), lang) || TARGET_FOLDER[target]
  const pad = compact ? "px-[1rem] py-[0.7rem]" : "px-[1.3rem] py-[0.9rem]"
  const pending = catalogTools.filter((t) => expected.includes(t.id))
  const silent = rows.filter((r) => r.source === "none")
  const firstChecking = rows
    .flatMap((r) => r.cells.map((c) => ({ tool: r.tool.id, target: c.target, kind: c.cell.kind })))
    .find((c) => c.kind === "checking")

  // One failure repeated in every cell says one thing; it is said once above the table, with the fix.
  const failed = rows.flatMap((r) =>
    r.cells.filter((c) => c.cell.kind === "failed" && !c.busy).map((c) => ({ tool: r.tool, cell: c.cell })),
  )
  const grouped = failed.length > 1
  const tried = usePathFix((s) => s.status.state === "done" || s.status.state === "failed")
  const [fixOpen, setFixOpen] = useState(false)
  const fixId = useId()
  const failedTools = [...new Set(failed.map((f) => f.tool.id))]
  const failedText = [
    ...new Set(failed.map((f) => (f.cell.kind === "failed" ? `${f.tool.name}: ${f.cell.message}` : ""))),
  ]

  if (detected && rows.length === 0) {
    return (
      <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-5 text-[0.95rem] text-ink-soft">
        {m.noTool}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {compact && found !== null && found.length === 0 && (
        <p className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]">{m.noAgent}</p>
      )}
      <Collapse open={grouped}>
        <ErrorNotice
          detail={
            <>
              <span className="block">{m.pathFix.skillsFailedHint}</span>
              <span className="selectable mt-1 block font-mono text-[0.85rem]">{failedText[0]}</span>
            </>
          }
          action={
            <span className="flex items-center gap-2">
              {/* The automatic fix first; once it ran and the checks still fail, an agent looks for the cause. */}
              {tried ? (
                <FixButton open={fixOpen} controls={fixId} onClick={() => setFixOpen((o) => !o)} />
              ) : (
                <PathFixButton tools={failedTools} />
              )}
              <ReportThis what="Checking skills" error={failedText.join("\n")} />
            </span>
          }
        >
          {m.pathFix.skillsFailed(failed.length)}
        </ErrorNotice>
        <FixPanel
          id={fixId}
          open={fixOpen}
          problem={{
            what: "Checking the agent skills of the WireCat tools it just installed",
            error: failedText.join("\n"),
            hint: "Putting the tools' folders on PATH and checking again did not help.",
          }}
        />
      </Collapse>
      <PathFixResult agent={names(found ?? []) || m.pathFix.yourAgents} manual={null} />
      <div className="overflow-x-auto rounded-[0.2rem] border border-line-strong bg-app">
        <table aria-label={m.matrixLabel} className="w-full border-collapse text-left">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className={cx(pad, "text-[0.9rem] font-medium text-ink-dim")}>
                {m.tool}
              </th>
              {targets.map((t) => (
                <th key={t} scope="col" className={cx(pad, "w-[34%] align-bottom font-normal", compact && "w-[38%]")}>
                  {agents === null ? (
                    <Skeleton className="h-5 w-32" label={m.lookingForAgents} />
                  ) : (
                    <span className="block text-[0.95rem] font-semibold text-ink">{columnName(t)}</span>
                  )}
                  {!compact && (
                    <span className="selectable mt-0.5 block font-mono text-[0.85rem] text-ink-dim">
                      {TARGET_FOLDER[t]}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!detected && pending.length > 0
              ? pending.map((t, i) => (
                  <tr key={t.id} className="border-line border-b align-top last:border-b-0">
                    <th scope="row" className={cx(pad, "font-normal")}>
                      <ToolName tool={t} version={<Skeleton chars={6} />} />
                    </th>
                    {targets.map((target) => (
                      <td key={target} className={pad}>
                        <div className="flex min-h-8 items-center">
                          <Skeleton
                            chars={12}
                            {...(i === 0 && target === targets[0] ? { label: m.checkingSkills } : {})}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              : !detected
                ? [0, 1, 2].map((i) => (
                    <tr key={i} className="border-line border-b last:border-b-0">
                      <td colSpan={targets.length + 1} className={pad}>
                        {i === 0 ? (
                          <Skeleton className="h-8 w-full" label={m.findingTools} />
                        ) : (
                          <Skeleton className="h-8 w-full" />
                        )}
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr key={r.tool.id} className="border-line border-b align-top last:border-b-0">
                      <th scope="row" className={cx(pad, "font-normal")}>
                        <ToolName tool={r.tool} version={r.cliVersion ?? ""} />
                        {r.cells.length > 1 && (
                          <InstallAll
                            tool={r.tool}
                            cells={r.cells}
                            readers={formatList(r.cells.map((c) => columnName(c.target)))}
                          />
                        )}
                      </th>
                      {r.cells.map((c) => (
                        <td key={c.target} className={pad}>
                          <Cell
                            first={r.tool.id === firstChecking?.tool && c.target === firstChecking.target}
                            cell={c.cell}
                            busy={c.busy}
                            failure={c.failure}
                            grouped={grouped}
                            primary={compact}
                            tool={r.tool.id}
                            toolName={r.tool.name}
                            column={columnName(c.target)}
                            report={`${r.tool.name} skill for ${columnName(c.target, "en")}`}
                            onInstall={(action) => askSkillInstall(r.tool.id, c.target, action, columnName(c.target))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
      {detected && notInstalled.length > 0 && !compact && (
        <p className="text-[0.9rem] text-ink-soft">{m.notInstalledNote(notInstalled.map((t) => t.name))}</p>
      )}
      {silent.length === 0 && firstChecking && (
        // Old tools are the usual case, so their note's line is kept until every skill has answered.
        <p className={cx("leading-snug", compact ? "text-[0.9rem]" : "text-[0.9rem]")}>
          <Skeleton chars={60} />
        </p>
      )}
      {silent.length > 0 && (
        // Last under the table, as it arrives last: inside a row it would push every row under it down.
        <p className={cx("leading-snug text-ink-soft", compact ? "text-[0.9rem]" : "text-[0.9rem]")}>
          {m.silent(silent.map((r) => r.tool.name))}{" "}
          {silent.some((r) => r.newer)
            ? compact
              ? m.fixOnTools
              : m.fixOnToolsTo(silent.flatMap((r) => (r.newer ? [m.toVersion(r.tool.name, r.newer)] : [])))
            : m.comingRelease}
        </p>
      )}
      {compact && <ConfirmCommand />}
    </div>
  )
}

type RowCell = ReturnType<typeof useSkillMatrix>["rows"][number]["cells"][number]

/**
 * One tool's skill for every agent found. Its line is held from the first check to the last install, so the row never
 * changes height under the owner: a placeholder while the cells are checked, then the button, then the result.
 */
function InstallAll({ tool, cells, readers }: { tool: CatalogTool; cells: readonly RowCell[]; readers: string }) {
  const m = useMessages(agentsMessages)
  const todo = cells.filter((c) => !c.busy && cellAction(c.cell) !== null)
  const working = cells.some((c) => c.busy)
  const update = todo.length > 0 && todo.every((c) => cellAction(c.cell) === "Update")
  const checking = cells.some((c) => c.cell.kind === "checking" && !c.busy)
  let content: ReactNode
  if (checking) content = <Skeleton chars={10} />
  else if (working || todo.length > 0)
    content = (
      <Button
        size="sm"
        variant="primary"
        // Not `disabled` while it runs: the dialog hands focus back to this button, and a disabled one drops it.
        aria-disabled={working || undefined}
        aria-label={
          working ? undefined : update ? m.updateSkill(tool.name, readers) : m.installEverywhere(tool.name, readers)
        }
        className="aria-disabled:cursor-default aria-disabled:opacity-60"
        onClick={() =>
          !working &&
          askToolSkills(
            tool.id,
            todo.map((c) => c.target),
            readers,
            update ? "Update" : "Install",
          )
        }
      >
        {working ? m.installingAll : update ? m.updateAll : m.installAll}
      </Button>
    )
  else
    content = (
      <span className="flex items-center gap-1.5 text-[0.9rem] text-ink-soft">
        <Check aria-hidden className="size-4 text-ok" />
        {m.allInstalled}
      </span>
    )
  return (
    <div aria-live="polite" className="mt-2 flex min-h-8 items-center pl-[2.3rem]">
      {content}
    </div>
  )
}

function ToolName({ tool, version }: { tool: CatalogTool; version: ReactNode }) {
  return (
    <div className="flex items-center gap-[0.8rem]">
      <ToolIcon id={tool.id} className="size-[1.5rem] shrink-0 text-ink" />
      <div className="min-w-0">
        <span className="block text-[1.02rem] font-semibold leading-tight">{tool.name}</span>
        <span className="selectable font-mono text-[0.85rem] text-ink-dim tabular-nums">
          {tool.bin} {version}
        </span>
      </div>
    </div>
  )
}

function Cell(props: {
  first: boolean
  cell: SkillCell
  busy: boolean
  failure: string | null
  /** The table's own notice already says why this cell failed. */
  grouped: boolean
  /** In onboarding an install is the step's whole point, so it is the button that stands out. */
  primary: boolean
  tool: string
  toolName: string
  column: string
  /** Names the failure in the bug report, which stays in English whatever the interface's language. */
  report: string
  onInstall: (action: "Install" | "Update") => void
}) {
  const { first, cell, busy, failure, grouped, primary, tool, toolName, column, report, onInstall } = props
  const m = useMessages(agentsMessages)
  if (cell.kind === "checking" && !busy)
    return (
      <div aria-live="polite">
        <div className="flex min-h-8 items-center">
          <Skeleton chars={12} {...(first ? { label: m.checkingSkills } : {})} />
        </div>
      </div>
    )
  const look = busy
    ? { tone: "busy" as const, word: m.writing }
    : { tone: SKILL_TONE[cell.kind], word: cell.kind === "unknown" ? m.unknown : m.state[cell.kind] }
  const action = cellAction(cell)
  const version = cell.kind === "current" || cell.kind === "stale" ? cell.installed : null
  return (
    <div aria-live="polite">
      <div className="flex min-h-8 items-center gap-2">
        <Lamp size="sm" tone={look.tone} label={m.skillState(toolName, column, look.word)} />
        <span className={cx("text-[0.95rem]", cell.kind === "stale" && !busy && "text-warn-ink")}>{look.word}</span>
        {version && <span className="selectable font-mono text-[0.9rem] text-ink-soft tabular-nums">{version}</span>}
        {action && (
          <Button
            size="sm"
            variant={primary && action === "Install" ? "primary" : "secondary"}
            className="ml-auto"
            disabled={busy}
            onClick={() => onInstall(action)}
            aria-label={action === "Install" ? m.installSkill(toolName, column) : m.updateSkill(toolName, column)}
          >
            {m.action[action]}
          </Button>
        )}
      </div>
      {cell.kind === "failed" && !busy && !grouped && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Checking the ${report}`} tool={tool} error={cell.message} />}
        >
          {cell.message}
        </ErrorNotice>
      )}
      {failure && !busy && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Writing the ${report}`} tool={tool} error={failure} />}
        >
          {failure}
        </ErrorNotice>
      )}
    </div>
  )
}
