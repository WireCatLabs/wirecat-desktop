import { CheckCircle2, CircleAlert, LoaderCircle, Play } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { type CatalogTool, findTool } from "@/domain/catalog"
import type { DamageReport } from "@/domain/store-damage"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { useStoreDamage } from "./damage-store"
import { openToolAt } from "./go"
import { damageMessages } from "./messages-damage"

const DAY_AND_TIME: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }

type Step = { index: number; state: "running" | "done" } | { index: number; state: "failed"; error: string }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * The tool's own `store recover` report, in its words, under a check that found the store damaged. A tool older than
 * the report answers none, and the check's own findings stay all there is.
 */
export function StoreDamage({ tool }: { tool: CatalogTool }) {
  const m = useMessages(damageMessages)
  // `undefined` until the first answer; a later check keeps the report on screen until the next one replaces it.
  const [report, setReport] = useState<DamageReport | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [wasDamaged, setWasDamaged] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const found = await platform.storeRecover(tool.id)
      setReport(found)
      if (found) setWasDamaged(true)
      useStoreDamage.getState().mark(tool.id, found !== null)
    } catch (e) {
      setError(message(e))
    }
  }, [tool.id])

  useEffect(() => {
    load()
  }, [load])

  const run = async (index: number) => {
    setStep({ index, state: "running" })
    try {
      await platform.storeRecoverStep(tool.id, index)
      await load()
      setStep({ index, state: "done" })
    } catch (e) {
      setStep({ index, state: "failed", error: message(e) })
    }
  }

  if (error)
    return (
      <ErrorNotice
        inline
        raw={error}
        action={<ReportThis what="Checking the message store" tool={tool.id} error={error} />}
      >
        {m.failed}
      </ErrorNotice>
    )
  if (report === undefined) return <Skeleton className="h-10 w-full" label={m.checking} />
  if (report === null)
    return wasDamaged ? (
      <p role="status" className="reveal flex items-center gap-2 text-[0.9rem] text-ink">
        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
        {m.healthy}
      </p>
    ) : null

  return (
    <section aria-label={m.title} className="flex flex-col gap-3 border-line border-t pt-2.5" aria-live="polite">
      <h5 className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
        <CircleAlert className="size-4 shrink-0 text-bad" aria-hidden />
        {m.title}
      </h5>
      <p className="selectable text-[0.9rem] text-ink">{report.what_happened}</p>

      <div className="flex flex-col gap-1">
        <h6 className="text-[0.85rem] font-medium text-ink-dim">{m.impact}</h6>
        <ul className="selectable flex list-disc flex-col gap-0.5 pl-5 text-[0.9rem] text-ink-soft">
          {report.impact.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>{report.external_data_safe}</li>
          {report.loss && <li>{report.loss}</li>}
        </ul>
        <LastOk at={report.last_ok_at} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h6 className="text-[0.85rem] font-medium text-ink-dim">{m.steps}</h6>
        <ol className="flex flex-col gap-2.5">
          {report.steps.map((s, i) => (
            <li key={`${s.command}\n${s.why}`} className="flex flex-col gap-1 text-[0.9rem]">
              <span className="selectable text-ink">
                <span className="text-ink-dim tabular-nums">{i + 1}. </span>
                {s.why}
              </span>
              {s.runnable ? (
                <RunnableStep command={s.command} step={step?.index === i ? step : null} onRun={() => run(i)} />
              ) : (
                <>
                  <CopyField value={s.command} label={m.copy} wrap />
                  {s.destructive && <span className="text-[0.85rem] text-ink-soft">{m.yourself}</span>}
                </>
              )}
            </li>
          ))}
        </ol>
      </div>

      {report.likely_causes.length > 0 && (
        <Disclosure summary={m.causes}>
          <ul className="flex flex-col gap-2 text-[0.9rem]">
            {report.likely_causes.map((c) => (
              <li key={c.cause} className="flex flex-col gap-1">
                <span className="selectable text-ink-soft">{c.cause}</span>
                {c.check && <CopyField value={c.check} label={m.check} wrap />}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </section>
  )
}

function LastOk({ at }: { at: string | null }) {
  const m = useMessages(damageMessages)
  const lang = useLang()
  const when = at ? new Date(at) : null
  const text =
    when && !Number.isNaN(when.getTime()) ? m.lastOk(new Intl.DateTimeFormat(lang, DAY_AND_TIME).format(when)) : null
  return <p className="text-[0.85rem] text-ink-dim">{text ?? m.noLastOk}</p>
}

function RunnableStep(props: { command: string; step: Step | null; onRun: () => void }) {
  const { command, step, onRun } = props
  const m = useMessages(damageMessages)
  const running = step?.state === "running"
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <code className="selectable min-w-0 flex-1 font-mono text-[0.85rem] wrap-anywhere text-ink">{command}</code>
        <Button
          size="sm"
          onClick={onRun}
          disabled={running}
          icon={
            running ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : step?.state === "done" ? (
              <CheckCircle2 className="size-4 text-ok" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )
          }
        >
          {running ? m.running : step?.state === "done" ? m.ran : m.run}
        </Button>
      </div>
      {step?.state === "failed" && (
        <p role="alert" className="text-[0.85rem] text-bad">
          {m.stepFailed(step.error)}
        </p>
      )}
    </div>
  )
}

/** One line above the tools while a report says the store is damaged; it opens the tool where the report is. */
export function StoreDamageLine() {
  const m = useMessages(damageMessages)
  const first = useStoreDamage((s) => s.damaged[0])
  const tool = first ? findTool(first) : undefined
  return (
    <Collapse open={tool !== undefined}>
      {tool && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem] text-ink">
          <CircleAlert className="size-4 shrink-0 text-bad" aria-hidden />
          {m.strip}
          <button
            type="button"
            onClick={() => openToolAt(tool.id, "accounts")}
            className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {m.open(tool.name)}
          </button>
        </p>
      )}
    </Collapse>
  )
}
