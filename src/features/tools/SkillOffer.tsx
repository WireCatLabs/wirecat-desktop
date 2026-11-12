import { BookOpen, CheckCircle2, Feather, HardDrive } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { needsUpdate, type SkillTarget } from "@/domain/skills"
import { useSkillMatrix } from "@/features/agents"
import { formatList, useMessages } from "@/i18n"
import { useAgents } from "@/shared/agents-store"
import { useNav } from "@/shared/nav"
import { ReportThis } from "@/shared/ReportThis"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { skillOfferMessages } from "./messages-skill"

const ICONS = [BookOpen, Feather, HardDrive]

/** Why a skill is worth adding, for the offer after an install and for the setup's Agents step. */
function SkillBenefits({ tool, className }: { tool: string; className?: string }) {
  const m = useMessages(skillOfferMessages)
  return (
    <ul aria-label={m.benefits} className={cx("grid gap-x-6 gap-y-3 sm:grid-cols-3", className)}>
      {m.points.map((point, i) => {
        const Icon = ICONS[i] ?? BookOpen
        return (
          <li key={point.title} className="flex items-start gap-2.5">
            <Icon className="mt-[0.2rem] size-[1.05rem] shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
            <p className="text-body leading-snug">
              <span className="block font-medium text-ink">{point.title}</span>
              <span className="text-ink-soft">{point.text(tool)}</span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Right after a first install: the tool's skill for the agents found on this computer, in one click. An update
 * refreshes copies that already exist instead (`install.rs`), so this is only for a tool new to the computer.
 */
export function SkillOffer({ tool }: { tool: CatalogTool }) {
  const m = useMessages(skillOfferMessages)
  const { found, rows, columns } = useSkillMatrix()
  const failures = useAgents((s) => s.failures)
  const row = rows.find((r) => r.tool.id === tool.id)
  const clicked = useRef(false)

  // After an install the store asks this tool again, but only once agents were looked for; a first visit looks here.
  useEffect(() => {
    const st = useAgents.getState()
    if (st.agents === null && !st.refreshing) void st.load([tool.id])
  }, [tool.id])

  const readers = (target: SkillTarget) => columns.find((c) => c.target === target)?.readers ?? []
  const cells = row?.cells.filter((c) => readers(c.target).length > 0 && c.cell.kind !== "unsupported") ?? []
  const names = formatList([...new Set(cells.flatMap((c) => readers(c.target).map((a) => a.name)))])
  const todo = cells.filter((c) => c.cell.kind === "missing" || needsUpdate(c.cell))
  const working = cells.some((c) => c.busy)
  const failure = cells.map((c) => failures[`${tool.id}:${c.target}`]).find(Boolean)
  const checking = found === null || !row || cells.some((c) => c.cell.kind === "checking")

  const add = () => {
    if (working) return
    clicked.current = true
    void useAgents.getState().installAll(todo.map((c): [string, SkillTarget] => [tool.id, c.target]))
  }

  let body: ReactNode
  let view = "button"
  if (found !== null && found.length === 0) {
    view = "no-agent"
    body = (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-[20rem] text-body text-ink-soft">{m.noAgent}</p>
        <Button size="sm" variant="secondary" onClick={() => useNav.getState().go("agents")}>
          {m.openAgents}
        </Button>
      </div>
    )
  } else if (checking) {
    view = "checking"
    body = <Skeleton className="h-8 w-[18rem]" label={m.looking} />
  } else if (todo.length === 0 && !working && cells.some((c) => c.cell.kind !== "current")) {
    // The tool could not say whether its skill is there (too old, or its status failed): claim nothing.
    view = "unclear"
    body = (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-[20rem] text-body text-ink-soft">{m.unclear(tool.name)}</p>
        <Button size="sm" variant="secondary" onClick={() => useNav.getState().go("agents")}>
          {m.openAgents}
        </Button>
      </div>
    )
  } else if (todo.length === 0 && !working) {
    view = "done"
    body = (
      <p className="flex min-h-8 items-center gap-2 text-body">
        <CheckCircle2 className="size-5 shrink-0 text-ok" aria-hidden />
        <span>{clicked.current ? m.added(names, tool.name) : m.already(names, tool.name)}</span>
      </p>
    )
  } else {
    body = (
      <Button size="sm" variant="primary" onClick={add} aria-busy={working}>
        {working ? m.adding : m.add(names)}
      </Button>
    )
  }

  return (
    <section
      aria-label={m.title(tool.name)}
      className="flex w-full flex-col gap-3 rounded-rack border border-line-strong bg-app px-[1.1rem] py-[1rem]"
    >
      <h3 className="text-[1.02rem] font-semibold leading-tight">{m.title(tool.name)}</h3>
      <SkillBenefits tool={tool.name} />
      {/* Add → Adding… → Added: one state fades into the next and the box's height follows. */}
      <AutoHeight swap={view} className="-mx-1 px-1">
        <div aria-live="polite">
          <Crossfade swap={view}>{body}</Crossfade>
        </div>
      </AutoHeight>
      <Collapse open={Boolean(failure) && !working}>
        {failure && (
          <ErrorNotice
            raw={failure}
            inline
            action={<ReportThis what={`Adding the ${tool.name} skill`} tool={tool.id} error={failure} />}
          >
            {m.failed}
          </ErrorNotice>
        )}
      </Collapse>
    </section>
  )
}
