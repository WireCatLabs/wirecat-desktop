import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { ToolIcon } from "../tools/ToolIcon"
import { logsMessages } from "./messages"
import { type LogsWords, toolName } from "./names"
import { type Keeping, type Source, timing, useLogs, useShownLogs } from "./store"

type Ask = { id: string; on: boolean; k: Extract<Keeping, { state: "ready" }> }

/** One row per tool: where its runs come from, how many are here, and which runs it keeps. */
export function LogSettings({ id }: { id: string }) {
  const m = useMessages(logsMessages)
  const sources = useShownLogs((s) => s.sources)
  const keeping = useShownLogs((s) => s.keeping)
  const { loadMore, setRecord } = useLogs.getState()
  const [ask, setAsk] = useState<Ask | null>(null)
  const ids = [...new Set([...Object.keys(sources), ...Object.keys(keeping)])]
  const firstKeeping = Object.keys(keeping)[0]

  const refused = Object.entries(keeping).flatMap(([tool, k]) =>
    k.state === "ready" && k.error ? [[tool, k.error] as const] : [],
  )
  const name = ask ? toolName(ask.id) : ""
  const bin = ask ? (findTool(ask.id)?.bin ?? ask.id) : ""

  return (
    <section id={id} aria-label={m.settings} className="flex max-w-[64rem] flex-col gap-[0.7rem]">
      <ul
        aria-label={m.sources}
        className="divide-y divide-line overflow-hidden rounded-[0.2rem] border border-line-strong bg-app"
      >
        {ids.map((tool) => (
          <Row
            key={tool}
            id={tool}
            source={sources[tool]}
            k={keeping[tool]}
            first={tool === firstKeeping}
            onMore={loadMore}
            onAsk={setAsk}
          />
        ))}
      </ul>
      {refused.map(([tool, error]) => (
        <p key={tool} role="alert" className="flex flex-wrap items-center gap-x-3 text-[0.9rem]">
          <span className="selectable text-bad">{m.refused(toolName(tool), error)}</span>
          <ReportThis what={`Changing whether ${toolName(tool)} keeps runs`} tool={tool} error={error} />
        </p>
      ))}

      <Dialog
        open={ask !== null}
        title={ask?.on ? m.askEvery(name) : m.askFailedOnly(name)}
        onClose={() => setAsk(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAsk(null)} autoFocus>
              {m.leaveIt}
            </Button>
            <Button
              onClick={() => {
                const a = ask
                setAsk(null)
                if (a) setRecord(a.id, a.on)
              }}
            >
              {ask?.on ? m.keepEvery : m.keepFailedOnly}
            </Button>
          </>
        }
      >
        {ask && <AskBody ask={ask} name={name} bin={bin} />}
      </Dialog>
    </section>
  )
}

/** The tone the Log settings button carries while its panel is closed, so a tool that failed is not hidden. */
export function settingsTone(sources: Record<string, Source>, keeping: Record<string, Keeping>): LampTone | null {
  const all = Object.values(sources)
  const keeps = Object.values(keeping)
  if (
    all.some((s) => s.state === "error") ||
    keeps.some((k) => k.state === "error" || (k.state === "ready" && k.error))
  )
    return "bad"
  return all.some((s) => s.state === "late") ? "warn" : null
}

type Choice = "failed" | "every"
type Ready = Extract<Keeping, { state: "ready" }>

const sourceTone = (s: Source): LampTone =>
  s.state === "loading"
    ? "busy"
    : s.state === "error"
      ? "bad"
      : s.state === "late"
        ? "warn"
        : s.state === "ready"
          ? "ok"
          : "idle"

export function sourceWords(m: LogsWords, s: Source): string {
  if (s.state === "late") return m.late(timing.answer / 1000, s.runs.length > 0)
  if (s.state === "none") return m.keepsNoLogs
  if (s.state === "missing") return m.notInstalled
  if (s.state === "update") return m.withNextUpdate(toolName(s.id))
  if (s.state === "error") return s.error ?? m.couldNotBeRead
  const n = s.runs.length
  const runs = m.runCount(n, s.hasMore)
  return s.state === "loading" ? (n ? m.readingOlder(runs) : m.readingShort) : runs
}

// A tool with no runs to show is a fact about the tool, not a fault: it reads as quietly as an empty row.
const quiet = (s: Source) => s.state === "none" || s.state === "missing" || s.state === "update"

/** "successful runs for 7 days, failed runs for 30 days"; older tools keep every run for one period. */
const periods = (m: LogsWords, k: Ready) =>
  k.successDays === null ? m.periodsEvery(k.days) : m.periodsSplit(k.successDays, k.days)

/** `k.locked` is the reason Rust gives, in English (src-tauri/src/settings.rs). */
function keeps(m: LogsWords, k: Ready): string {
  const now = k.record ? m.keeps(periods(m, k)) : m.keepsFailedOnly(k.days)
  return [now, k.locked, k.error && m.keepRefused(k.error)].filter(Boolean).join(". ")
}

// Every row is as tall as two lines of text whether or not its settings have arrived, so nothing below moves.
function Row(props: {
  id: string
  source: Source | undefined
  k: Keeping | undefined
  first: boolean
  onMore: (id: string) => void
  onAsk: (a: Ask) => void
}) {
  const { id, source, k, first, onMore, onAsk } = props
  const m = useMessages(logsMessages)
  const name = toolName(id)
  return (
    <li className="grid min-h-[3.9rem] grid-cols-[minmax(7.5rem,11.5rem)_minmax(0,1fr)_auto] items-center gap-x-[1.2rem] px-[1.3rem] py-[0.6rem]">
      <span className="flex min-w-0 items-center gap-[0.55rem]">
        {source ? (
          <Lamp tone={sourceTone(source)} size="sm" label={sourceWords(m, source)} />
        ) : (
          <Lamp tone="idle" size="sm" />
        )}
        <ToolIcon id={id} className="size-[1rem] shrink-0 text-ink-soft" />
        <span className="truncate font-medium text-[0.95rem]">{name}</span>
      </span>

      <span className="flex min-w-0 flex-col gap-[0.1rem] text-[0.9rem]">
        {source && (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-[0.7rem]">
            <span
              className={cx(
                "tabular-nums first-letter:uppercase",
                quiet(source) ? "text-ink-dim" : source.state === "error" ? "text-bad" : "text-ink",
              )}
              title={source.error ?? undefined}
            >
              {sourceWords(m, source)}
            </span>
            {source.state === "error" && (
              <ReportThis what={`Reading ${name} runs`} tool={id} error={source.error ?? "could not be read"} />
            )}
            {source.hasMore && source.state === "ready" && (
              <button
                type="button"
                onClick={() => onMore(id)}
                className="font-medium text-brand hover:text-brand-hover"
              >
                {m.loadOlder}
              </button>
            )}
          </span>
        )}
        {k?.state === "loading" && (
          <Skeleton className="h-[1.1rem] w-[16rem] max-w-full" {...(first && { label: m.readingKeeping })} />
        )}
        {k?.state === "none" && <span className="text-[0.85rem] text-ink-dim">{m.keepsNoChoice}</span>}
        {k?.state === "error" && (
          <span className="text-[0.85rem] text-bad">{m.keepError(k.error ?? m.noRecordSetting)}</span>
        )}
        {k?.state === "ready" && (
          <span className={cx("text-[0.85rem]", k.error ? "text-bad" : "text-ink-dim")}>{keeps(m, k)}</span>
        )}
      </span>

      <span className="flex w-[12rem] justify-end">
        {k?.state === "loading" && <Skeleton className="h-8 w-full" />}
        {/* One report per row: a tool that could not be read at all is reported beside its runs. */}
        {k?.state === "error" && source?.state !== "error" && (
          <ReportThis
            what={`Reading ${name} run settings`}
            tool={id}
            error={k.error ?? logsMessages.en.noRecordSetting}
          />
        )}
        {k?.state === "ready" && (
          <Select<Choice>
            size="sm"
            aria-label={m.whichRuns(name)}
            value={k.record ? "every" : "failed"}
            options={[
              { value: "failed", label: m.choiceFailed },
              { value: "every", label: m.choiceEvery },
            ]}
            disabled={k.saving || Boolean(k.locked)}
            onChange={(v) => {
              if ((v === "every") !== k.record) onAsk({ id, on: v === "every", k })
            }}
            className="w-full"
          />
        )}
      </span>
    </li>
  )
}

const Code = ({ children }: { children: string }) => (
  <code className="font-mono text-[0.88rem] text-ink">{children}</code>
)

function AskBody({ ask, name, bin }: { ask: Ask; name: string; bin: string }) {
  const m = useMessages(logsMessages)
  const { k } = ask
  // Going to the tool's own default removes the setting; the other value is written into the defaults.
  const command =
    ask.on === k.everyByDefault
      ? `${bin} config unset --defaults record`
      : `${bin} config set --defaults record ${String(ask.on)}`
  const how = ask.on === k.everyByDefault ? m.howUnset(<Code>{command}</Code>) : m.howSet(<Code>{command}</Code>, name)
  const record = <code className="font-mono">record</code>
  if (ask.on)
    return (
      <div className="flex flex-col gap-3">
        <p>{m.everyBody(name, periods(m, k))}</p>
        <p>
          {how} {m.everyProfiles(record)}
        </p>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <p>{m.failedOnlyBody(name, k.days, k.successDays)}</p>
      <p>
        {how} {m.failedOnlyProfiles(record)}
      </p>
    </div>
  )
}
