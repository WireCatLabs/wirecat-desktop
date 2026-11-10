import { useEffect, useRef } from "react"
import { findTool, ownerId, signsInHere } from "@/domain/catalog"
import { InstallLine, openToolAt, syncKey, useSync, useTerminal } from "@/features/tools"
import { useMessages } from "@/i18n"
import { ReportThis } from "@/shared/ReportThis"
import { useSignIn } from "@/shared/signin-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { problemMessages } from "./messages-problems"
import { type Problem, problemKey, uniqueProblems } from "./problems"
import { useAnalytics } from "./store"

const nameOf = (id: string) => findTool(id)?.name ?? id

/**
 * What stands between a card and its numbers, each with the one action that fixes it: install, update, sign in, load.
 * The tool's own words are folded under "Details", never the first thing the owner reads.
 */
export function SourceProblems({ problems, className }: { problems: readonly Problem[]; className?: string }) {
  const list = uniqueProblems(problems)
  if (!list.length) return null
  return (
    <ul className={cx("m-0 flex list-none flex-col gap-3 p-0", className)}>
      {list.map((p) => (
        <li key={problemKey(p)}>
          <ProblemLine problem={p} />
        </li>
      ))}
    </ul>
  )
}

function ProblemLine({ problem: p }: { problem: Problem }) {
  const m = useMessages(problemMessages)
  const tool = nameOf(p.tool)
  const words =
    p.kind === "missing"
      ? m.missing(tool)
      : p.kind === "old"
        ? m.old(tool)
        : p.kind === "signedOut"
          ? m.signedOut(tool, p.profile)
          : p.kind === "empty"
            ? m.empty(tool, p.profile)
            : m.failed(tool, p.profile)
  const detail = p.kind === "old" || p.kind === "empty" || p.kind === "failed" ? p.detail : ""
  return (
    <div className="flex flex-col gap-1.5 text-[0.9rem] text-ink-soft">
      <p>
        {words}
        {p.kind === "failed" && <span className="text-ink-dim"> {m.failedHint}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Action problem={p} />
      </div>
      {(detail || (p.kind === "failed" && p.command)) && (
        <Disclosure summary={m.details}>
          <div className="selectable flex flex-col gap-1 font-mono text-[0.85rem] text-ink-dim">
            {detail && <p>{detail}</p>}
            {p.kind === "failed" && p.command && (
              <p>
                {m.command}: {p.command}
              </p>
            )}
          </div>
        </Disclosure>
      )}
    </div>
  )
}

function Action({ problem: p }: { problem: Problem }) {
  const m = useMessages(problemMessages)
  const tool = nameOf(p.tool)
  const session = useTools((s) => s.sessions[ownerId(p.tool)])
  const run = useSync((s) => ("profile" in p ? s.runs[syncKey(p.tool, p.profile)] : undefined))
  const reload = useAnalytics((s) => s.reload)
  const phase = run?.phase
  const was = useRef(phase)
  // The counts are kept for the session; a load that just finished is the moment to read them again.
  useEffect(() => {
    if (was.current === "running" && phase === "done") reload()
    was.current = phase
  }, [phase, reload])
  if ((p.kind === "missing" || p.kind === "old") && session && !session.outcome)
    return <InstallLine session={session} name={tool} />
  switch (p.kind) {
    case "missing":
    case "old":
      return (
        <Button size="sm" onClick={() => useTools.getState().install(p.tool, { check: true })}>
          {p.kind === "missing" ? m.install(tool) : m.update(tool)}
        </Button>
      )
    case "signedOut": {
      const entry = findTool(p.tool)
      const signIn = () =>
        entry && signsInHere(entry)
          ? useSignIn.getState().start(p.tool, p.profile, reload)
          : useTerminal.getState().open(p.tool, p.profile)
      return (
        <>
          <Button size="sm" onClick={signIn}>
            {m.signIn}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openToolAt(p.tool, "accounts")}>
            {m.removeProfile}
          </Button>
        </>
      )
    }
    case "empty":
      return run?.phase === "running" ? (
        <span className="text-[0.9rem]">{m.loading}</span>
      ) : (
        <Button size="sm" onClick={() => useSync.getState().start(p.tool, p.profile)}>
          {m.load}
        </Button>
      )
    case "failed":
      return (
        <>
          <Button size="sm" variant="secondary" onClick={reload}>
            {m.tryAgain}
          </Button>
          <ReportThis what={`Analytics: ${tool}`} tool={p.tool} command={p.command ?? null} error={p.detail} />
        </>
      )
  }
}
