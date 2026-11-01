import { termText } from "@/domain/runs"
import { useLang, useMessages } from "@/i18n"
import type { AgentCall } from "@/platform/memory-schemas"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { dayLabel, timeOf } from "./labels"
import { memoryMessages } from "./messages"

/**
 * Memo's own log of agents' calls (`memo agents list`): the agent, the call and when, never its arguments. Owner's
 * choice (NEED-168): it sits on this page, with everything else in Logs.
 */
/** Memo's runs that read or changed memory: memories, facts, actions and project findings, OR-ed by the Logs query. */
export const MEMORY_RUNS = [
  termText("tool", "memo"),
  ...["memories *", "facts *", "actions *", "projects actions *"].map((c) => termText("command", c)),
].join(" ")

export function openMemoryLogs() {
  const logs = useLogs.getState()
  logs.setQuery(MEMORY_RUNS)
  logs.setRange("all")
  useNav.getState().go("logs")
}

export function Activity({ calls, error }: { calls: AgentCall[] | null; error: string | null }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()

  return (
    <section aria-labelledby="memory-activity" className="flex flex-col gap-[0.6rem]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="memory-activity" className="text-[1.05rem] font-semibold">
          {m.activity}
        </h2>
        <button
          type="button"
          onClick={openMemoryLogs}
          className="cursor-pointer text-[0.9rem] font-medium text-brand hover:text-brand-hover"
        >
          {m.toLogs}
        </button>
      </div>
      {calls === null ? (
        <ErrorNotice>
          {m.activityFailed} {error}
        </ErrorNotice>
      ) : calls.length === 0 ? (
        <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[0.9rem] text-[0.95rem] text-ink-soft">
          {m.activityNone}
        </p>
      ) : (
        <ul className="rounded-[0.2rem] border border-line-strong bg-app">
          {calls.map((c) => {
            const known = m.calls[c.tool]
            const failed = c.status !== "ok"
            return (
              <li
                key={c.id}
                className="grid grid-cols-[0.85rem_minmax(6rem,10rem)_minmax(0,1fr)_auto] items-center gap-[0.9rem] border-line px-[1.3rem] py-[0.6rem] text-[0.95rem] not-first:border-t"
              >
                <Lamp tone={failed ? "bad" : "ok"} size="sm" {...(failed ? { label: m.callFailed } : {})} />
                <span className="truncate font-mono text-[0.85rem]">{c.agent ?? m.anAgent}</span>
                <span className="min-w-0 truncate text-ink-soft" title={c.error ?? undefined}>
                  {known ?? (
                    <>
                      {m.called} <span className="font-mono text-[0.85rem]">{c.tool}</span>
                    </>
                  )}
                  {failed && <span className="text-bad"> · {c.error ?? m.callFailed}</span>}
                </span>
                <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">
                  {dayLabel(c.at, m, lang)} {timeOf(c.at, lang)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
