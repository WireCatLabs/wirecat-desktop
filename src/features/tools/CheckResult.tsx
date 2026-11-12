import { AlertTriangle, CheckCircle2, FolderOpen, X, XCircle } from "lucide-react"
import { useCallback, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { type ConfigPlace, type Finding, summarize } from "@/domain/doctor"
import { storeDamaged } from "@/domain/store-damage"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Diagnosis } from "@/platform/schemas"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ConfigRepair, offersRepair, type Repaired } from "./ConfigRepair"
import { type ToolsText, toolsMessages } from "./messages"
import { accountsMessages } from "./messages-accounts"
import { StoreDamage } from "./StoreDamage"

type Words = ToolsText["health"]

export type Check =
  | { profile: string | null; state: "running" }
  | { profile: string | null; state: "done"; result: Diagnosis }

const findingIcon = (f: Finding) =>
  f.tone === "ok" ? (
    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
  ) : f.tone === "warn" ? (
    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
  ) : (
    <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
  )

const findingKey = (f: Finding) =>
  [f.text ?? f.note, f.config?.file, f.config?.profile, f.config?.key, f.config?.line].filter(Boolean).join("|")

/** The tool's own words as it said them; the app's notes in the reader's language. */
function said(f: Finding, m: Words): string {
  if (f.text !== undefined) return f.text
  const code = f.exitCode === null || f.exitCode === undefined ? m.unknownCode : String(f.exitCode)
  if (f.note === "unreadable") return m.unreadable(code)
  if (f.note === "stopped") return m.stopped(code)
  return f.note ? m.note[f.note] : ""
}

function where({ file, profile, key, line, column }: ConfigPlace) {
  const at = file && line !== undefined ? `${file}:${line}${column !== undefined ? `:${column}` : ""}` : file
  return [at, profile && `profile ${profile}`, key && `key ${key}`].filter(Boolean).join(" · ")
}

function ConfigProblems(props: {
  findings: Finding[]
  tool: CatalogTool
  profile: string | null
  m: Words
  onRepaired: (r: Repaired) => void
}) {
  const { findings, tool, profile, m, onRepaired } = props
  const toolId = tool.id
  const [openError, setOpenError] = useState<string | null>(null)
  const open = async () => {
    try {
      await platform.openFolder(toolId, "config")
      setOpenError(null)
    } catch (e) {
      setOpenError(String(e))
    }
  }
  return (
    <section aria-label={m.configProblems} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-[0.9rem] font-medium text-ink-dim">{m.configProblems}</h5>
        <Button size="sm" variant="ghost" onClick={open} icon={<FolderOpen className="size-4" aria-hidden />}>
          {m.openSettingsFolder}
        </Button>
      </div>
      {openError && (
        <ErrorNotice inline action={<ReportThis what="Opening the settings folder" tool={toolId} error={openError} />}>
          {openError}
        </ErrorNotice>
      )}
      <ul className="flex flex-col gap-3">
        {findings.map((f) => {
          const at = f.config ? where(f.config) : ""
          return (
            <li key={findingKey(f)} className="flex items-start gap-2 text-[0.9rem]">
              {findingIcon(f)}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span>{said(f, m)}</span>
                {at && <code className="selectable font-mono text-[0.85rem] break-all text-ink-soft">{at}</code>}
                {f.fix && !offersRepair(tool, f) && <CopyField value={f.fix} label={m.copyFix} />}
                <ConfigRepair tool={tool} finding={f} profile={profile} onRepaired={onRepaired} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** What the tool's repair changed, kept above the fresh check so the owner sees why the problem is gone. */
function RepairedNote({ repaired, m }: { repaired: Repaired; m: Words }) {
  if (repaired.state === "unchanged")
    return (
      <p role="status" className="reveal flex items-center gap-2 text-[0.9rem] text-ink-soft">
        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
        {repaired.reason === "no settings file" ? m.repairNoFile : m.repairNothing}
      </p>
    )
  const said = (kind: string) => m.repairKind[kind as keyof Words["repairKind"]] ?? kind.replaceAll("_", " ")
  const what = repaired.changes
    .map((c) => (c.line === null ? said(c.kind) : `${said(c.kind)} (${m.atLine(c.line)})`))
    .join("; ")
  return (
    <div role="status" className="reveal flex items-start gap-2 rounded-control bg-ok/10 px-3 py-2 text-[0.9rem]">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <span>{what ? m.repaired(what) : m.repairedNothingListed}</span>
        {repaired.backup && (
          <span className="text-ink-soft">
            {m.backupAt} <code className="selectable font-mono text-[0.85rem] break-all">{repaired.backup}</code>
          </span>
        )}
      </div>
    </div>
  )
}

function CheckResult(props: {
  check: Check
  tool: CatalogTool
  onRepaired: (r: Repaired) => void
  /** Room on the right for the × that closes it. */
  closable?: boolean
}) {
  const { check, tool, onRepaired, closable } = props
  const m = useMessages(toolsMessages).health
  if (check.state === "running") return <Skeleton className="h-16 w-full" label={m.running} />
  const { result } = check
  const findings = summarize(result.report, result.exitCode)
  const config = findings.filter((f) => f.config)
  const other = findings.filter((f) => !f.config)
  return (
    <div
      className={cx("flex flex-col gap-2 rounded-inset border border-line bg-app p-3", closable && "pr-11")}
      aria-live="polite"
    >
      {config.length > 0 && (
        <ConfigProblems findings={config} tool={tool} profile={check.profile} m={m} onRepaired={onRepaired} />
      )}
      {other.length > 0 && (
        <ul className={cx("flex flex-col gap-1.5", config.length > 0 && "border-line border-t pt-2.5")}>
          {other.map((f) => (
            <li key={findingKey(f)} className="flex items-start gap-2 text-[0.9rem]">
              {findingIcon(f)}
              <span>
                {said(f, m)}
                {f.fix && (
                  <>
                    {" "}
                    <span className="text-ink-dim">{m.fix}</span>{" "}
                    <code className="selectable font-mono text-[0.9rem]">{f.fix}</code>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {tool.storeRecover && storeDamaged(result.report) && <StoreDamage tool={tool} />}
      <Disclosure summary={m.technical}>
        <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.85rem] text-ink-soft">
          <dt>{m.command}</dt>
          <dd className="selectable font-mono text-ink">{result.command}</dd>
          <dt>{m.exitCode}</dt>
          <dd className="font-mono text-ink">{result.exitCode ?? m.none}</dd>
          <dt>{m.took}</dt>
          <dd className="font-mono text-ink">{(result.durationMs / 1000).toFixed(1)} s</dd>
        </dl>
        <pre className="selectable max-h-56 overflow-auto rounded-control bg-app-2 p-2.5 font-mono text-[0.85rem] leading-relaxed text-ink-soft">
          {JSON.stringify(result.report, null, 2) ?? result.stderr}
        </pre>
        <p className="mt-1.5 text-[0.85rem] text-ink-dim">{m.hidden}</p>
      </Disclosure>
    </div>
  )
}

/** One doctor run per place it is shown: a row's own check, or the tool's. */
export function useCheck(tool: CatalogTool) {
  const [check, setCheck] = useState<Check | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [repaired, setRepaired] = useState<Repaired | null>(null)
  const run = useCallback(
    async (profile: string | null, keepRepaired = false) => {
      if (!keepRepaired) setRepaired(null)
      setCheck({ profile, state: "running" })
      setError(null)
      try {
        setCheck({ profile, state: "done", result: await platform.diagnose(tool.id, profile) })
      } catch (e) {
        setCheck(null)
        setError(String(e))
      }
    },
    [tool.id],
  )
  const clear = useCallback(() => {
    setCheck(null)
    setError(null)
    setRepaired(null)
  }, [])
  const shown = check !== null || error !== null || repaired !== null
  return { check, error, repaired, setRepaired, run, clear, shown, running: check?.state === "running" }
}

type CheckState = ReturnType<typeof useCheck>

/** What a check found, where it was asked for; the × folds it away. */
export function CheckPanel({ tool, c, onClose }: { tool: CatalogTool; c: CheckState; onClose?: () => void }) {
  const m = useMessages(toolsMessages).health
  const close = useMessages(accountsMessages).row.closeCheck
  const { check } = c
  return (
    <div className="flex flex-col gap-2">
      {c.error && (
        <ErrorNotice inline action={<ReportThis what={`Checking ${tool.name}`} tool={tool.id} error={c.error} />}>
          {c.error}
        </ErrorNotice>
      )}
      {c.repaired && <RepairedNote repaired={c.repaired} m={m} />}
      {check && (
        <div className="relative">
          <CheckResult
            check={check}
            tool={tool}
            closable={onClose !== undefined}
            onRepaired={(r) => {
              c.setRepaired(r)
              c.run(check.profile, true)
            }}
          />
          {onClose && check.state === "done" && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-1.5 right-1.5"
              onClick={onClose}
              aria-label={close}
              title={close}
              icon={<X className="size-4" aria-hidden />}
            />
          )}
        </div>
      )}
    </div>
  )
}
