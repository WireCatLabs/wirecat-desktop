import { CircleCheck, Download, FileUp, ListChecks, LoaderCircle, Upload } from "lucide-react"
import { useEffect, useId } from "react"
import { useMessages } from "@/i18n"
import type { Receipt, ReceiptLine, RecordColumn } from "@/platform/records-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import { fieldClass } from "@/ui/field"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { type Format, useImport } from "./import-store"
import { importMessages } from "./messages-import"

type M = typeof importMessages.en

/** `provider:account`, as memo's `--account` takes it. */
const SOURCE = /^[a-z0-9][\w.-]*:\S+$/i
const SHOWN = 50

export function ImportPanel() {
  const m = useMessages(importMessages)
  const s = useImport()
  const { load, choose, saveTemplate, pick, check, run } = useImport.getState()
  const sourceId = useId()
  const sourceHelpId = useId()
  const fileId = useId()
  const importId = useId()
  const noSource = useFieldError(sourceId)
  const noFile = useFieldError(fileId)
  const noImport = useFieldError(importId)

  useEffect(() => {
    load()
  }, [load])

  const sourceOk = SOURCE.test(s.account.trim())
  const columns = s.types?.find((t) => t.type === s.kind)?.columns ?? []
  const checked = s.checked?.kind === "receipt" ? s.checked.receipt : null
  const canImport = checked !== null && checked.created + checked.updated + checked.deleted > 0
  const askCheck = () => {
    if (!sourceOk) return noSource.fail(s.account.trim() === "" ? m.sourceNeeded : m.sourceInvalid)
    if (!s.file) return noFile.fail(m.fileNeeded)
    check()
  }
  const askImport = () => {
    if (!canImport) return noImport.fail(checked === null ? m.checkFirst : m.nothingToImport)
    run()
  }

  return (
    <section aria-labelledby="import-title" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="border-line border-b px-[1.3rem] py-[0.9rem]">
        <h2 id="import-title" className="text-[1.08rem] font-semibold">
          {m.title}
        </h2>
        <p className="mt-0.5 max-w-[80ch] text-[0.9rem] text-ink-dim">{m.intro}</p>
      </div>

      {s.types === undefined ? (
        <div className="px-[1.3rem] py-[0.9rem]">
          <Skeleton className="h-[2.4rem] w-full" label={m.readingTypes} />
        </div>
      ) : s.types === null ? (
        <p className="px-[1.3rem] py-[0.9rem] text-[0.95rem] text-ink-soft">{m.tooOld}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-line border-b px-[1.3rem] py-[0.9rem]">
            <div className="flex flex-wrap items-end gap-3">
              <Labelled label={m.type}>
                <Select
                  aria-label={m.type}
                  size="sm"
                  value={s.kind ?? ""}
                  onChange={(kind) => choose({ kind })}
                  options={s.types.map((t) => ({ value: t.type, label: t.type }))}
                  className="min-w-[11rem]"
                />
              </Labelled>
              <Labelled label={m.format}>
                <Select<Format>
                  aria-label={m.format}
                  size="sm"
                  value={s.format}
                  onChange={(format) => choose({ format })}
                  options={[
                    { value: "csv", label: "CSV" },
                    { value: "json", label: "JSON" },
                  ]}
                />
              </Labelled>
              {s.format === "csv" && (
                <Labelled label={m.separator}>
                  <Select<"," | ";">
                    aria-label={m.separator}
                    size="sm"
                    value={s.separator}
                    onChange={(separator) => choose({ separator })}
                    options={[
                      { value: ",", label: m.comma },
                      { value: ";", label: m.semicolon },
                    ]}
                  />
                </Labelled>
              )}
              <Button
                size="sm"
                onClick={() => saveTemplate()}
                disabled={!s.kind || s.busy !== null}
                icon={<Download className="size-4" aria-hidden />}
              >
                {m.download}
              </Button>
            </div>
            {s.saved && (
              <p role="status" className="selectable text-[0.9rem] text-ink-soft">
                {m.saved(s.saved)}
              </p>
            )}
            {columns.length > 0 && (
              <Disclosure summary={m.columns}>
                <ColumnList columns={columns} m={m} />
              </Disclosure>
            )}
          </div>

          <div className="flex flex-col gap-3 px-[1.3rem] py-[0.9rem]">
            <div className="flex flex-col gap-1">
              <label htmlFor={sourceId} className="text-[0.9rem] font-medium">
                {m.source}
              </label>
              <input
                id={sourceId}
                value={s.account}
                onChange={(e) => {
                  choose({ account: e.target.value })
                  noSource.clear()
                }}
                placeholder={m.sourceExample}
                spellCheck={false}
                aria-describedby={noSource.error ? `${sourceId}-error ${sourceHelpId}` : sourceHelpId}
                aria-invalid={noSource.error !== null || (s.account.trim() !== "" && !sourceOk)}
                className={cx(fieldClass, invalidBorder, "max-w-[22rem] font-mono")}
              />
              {noSource.hint}
              <p id={sourceHelpId} className="max-w-[80ch] text-[0.85rem] text-ink-dim">
                {s.account.trim() !== "" && !sourceOk ? m.sourceInvalid : m.sourceHelp}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                id={fileId}
                size="sm"
                aria-describedby={noFile.error ? `${fileId}-error` : undefined}
                onClick={() => {
                  noFile.clear()
                  pick()
                }}
                disabled={s.busy !== null}
                icon={<FileUp className="size-4" aria-hidden />}
              >
                {m.chooseFile}
              </Button>
              <span className="selectable min-w-0 truncate font-mono text-[0.85rem] text-ink-soft">
                {s.file ?? m.noFile}
              </span>
            </div>
            {noFile.hint}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={askCheck}
                disabled={s.busy !== null}
                icon={<ListChecks className="size-4" aria-hidden />}
              >
                {m.check}
              </Button>
              <Button
                id={importId}
                size="sm"
                variant="primary"
                aria-describedby={noImport.error ? `${importId}-error` : undefined}
                onClick={askImport}
                disabled={s.busy !== null}
                icon={<Upload className="size-4" aria-hidden />}
              >
                {m.import}
              </Button>
              {(s.busy === "check" || s.busy === "import") && (
                <span role="status" className="flex items-center gap-1.5 text-[0.9rem] text-ink-soft">
                  <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
                  {s.busy === "check" ? m.checking : m.importing}
                </span>
              )}
            </div>
            {noImport.hint}
            <Result m={m} />
          </div>
        </>
      )}
      {s.error && (
        <p role="alert" className="border-line border-t px-[1.3rem] py-[0.9rem] text-[0.95rem] text-bad">
          {s.error}
        </p>
      )}
    </section>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden className="text-[0.85rem] text-ink-dim">
        {label}
      </span>
      {children}
    </div>
  )
}

function ColumnList({ columns, m }: { columns: RecordColumn[]; m: M }) {
  return (
    <ul className="flex flex-col gap-1 pt-2 text-[0.9rem]">
      {columns.map((c) => (
        <li key={c.name} className="flex flex-wrap gap-x-2">
          <code className="selectable font-mono text-ink">{c.name}</code>
          {c.required && <span className="text-brand">{m.required}</span>}
          <span className="text-ink-dim">
            {[
              c.shape !== "text" ? c.shape : null,
              c.values?.length ? m.oneOf(c.values.join(", ")) : null,
              c.targets?.length ? m.linksTo(c.targets.join(", ")) : null,
              c.description || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Result({ m }: { m: M }) {
  const { checked, imported, busy } = useImport()
  const outcome = imported ?? checked
  if (busy === "check" || busy === "import") return null
  if (!outcome) return <p className="text-[0.95rem] text-ink-soft">{m.checkFirst}</p>
  if (outcome.kind === "failed")
    return (
      <p role="alert" className="text-[0.95rem] text-bad">
        {m.failed(outcome.message)}
      </p>
    )
  const r = outcome.receipt
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-[0.95rem]">
        {imported && <CircleCheck className="size-4 text-good" aria-hidden />}
        {imported ? m.done : r.refused > 0 ? m.checkedRefused(r.refused) : m.checkedClean}
      </p>
      <Counts r={r} m={m} lead={imported ? null : m.wouldBe} />
      <Lines title={m.problems} lines={r.errors} m={m} bad />
      <Lines title={m.waitingList} lines={r.waiting} m={m} />
      {r.proposed.length > 0 && <p className="text-[0.9rem] text-ink-soft">{m.proposed(r.proposed.length)}</p>}
      {r.truncated && <p className="text-[0.85rem] text-ink-dim">{m.truncated}</p>}
    </div>
  )
}

function Counts({ r, m, lead }: { r: Receipt; m: M; lead: string | null }) {
  const counts: [keyof M["counts"], number][] = [
    ["created", r.created],
    ["updated", r.updated],
    ["unchanged", r.unchanged],
    ["deleted", r.deleted],
    ["refused", r.refused],
    ["waiting", r.waiting.length],
    ["unmatched", r.unmatched.length],
    ["flagged", r.flagged.length],
  ]
  return (
    <p className="flex flex-wrap gap-x-3 text-[0.9rem] text-ink-soft">
      {lead && <span>{lead}:</span>}
      {counts
        .filter(([key, n]) => n > 0 || key === "created")
        .map(([key, n]) => (
          <span key={key}>
            <span className="font-mono text-ink tabular-nums">{n}</span> {m.counts[key]}
          </span>
        ))}
    </p>
  )
}

function Lines({ title, lines, m, bad }: { title: string; lines: ReceiptLine[]; m: M; bad?: boolean }) {
  if (lines.length === 0) return null
  return (
    <div>
      <h3 className="text-[0.9rem] font-medium">{title}</h3>
      <ul className="mt-1 flex flex-col gap-0.5 text-[0.9rem]">
        {lines.slice(0, SHOWN).map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two refusals of one record differ only by their place
          <li key={i} className="flex flex-wrap gap-x-2">
            {l.place && <span className="font-mono text-ink-dim">{m.where(l.place.line, l.place.column)}</span>}
            {l.key && <code className="selectable font-mono text-ink">{l.key}</code>}
            <span className={bad ? "text-bad" : "text-ink-soft"}>
              {l.message ?? l.reason ?? (l.missing ? m.waitingFor(l.missing.join(", ")) : l.code)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
