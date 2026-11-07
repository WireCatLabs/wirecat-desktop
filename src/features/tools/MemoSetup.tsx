import { Check } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import type { SyncSummary } from "@/domain/sync"
import { useMessages } from "@/i18n"
import type { NotesFolder, NotesModel, NotesProblem, NotesSetup } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ProgressBar } from "@/ui/ProgressBar"
import { Skeleton } from "@/ui/Skeleton"
import { type NotesSetupText, notesSetupMessages } from "./messages-notes-setup"
import { megabytes, syncProblem } from "./notes-setup"

type FolderStep = { phase: "idle" } | { phase: "picking" | "adding" } | { phase: "added"; name: string } | Failed
type SyncStep = { phase: "idle" | "running" } | { phase: "done"; summary: SyncSummary } | Failed
type ModelStep = { phase: "idle" | "downloading" | "preparing" | "stopped" | "done" } | Failed
type Failed = { phase: "failed"; problem: NotesProblem }

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * memo's first run on its details page: which folders hold the notes, the first read of them, and the optional search
 * model. A separate section from the services panel. Every step is one of memo's own commands, run by Rust.
 */
export function MemoSetup({ tool }: { tool: CatalogTool }) {
  const m = useMessages(notesSetupMessages)
  const headingId = useId()
  const [setup, setSetup] = useState<NotesSetup | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [folderStep, setFolderStep] = useState<FolderStep>({ phase: "idle" })
  const [syncStep, setSyncStep] = useState<SyncStep>({ phase: "idle" })
  const [modelStep, setModelStep] = useState<ModelStep>({ phase: "idle" })

  const load = useCallback(() => {
    platform.notesSetupStatus(tool.id).then(setSetup, (e) => setLoadError(messageOf(e)))
  }, [tool.id])
  useEffect(load, [load])

  const pickFolder = async () => {
    setFolderStep({ phase: "picking" })
    try {
      const path = await platform.notesPickFolder()
      if (path === null) return setFolderStep({ phase: "idle" })
      setFolderStep({ phase: "adding" })
      const answer = await platform.notesFolderAdd(tool.id, path)
      if (answer.result === "failed") return setFolderStep({ phase: "failed", problem: answer.problem })
      setFolderStep({ phase: "added", name: answer.folder.name })
      setSyncStep({ phase: "idle" })
      load()
    } catch {
      setFolderStep({ phase: "failed", problem: "other" })
    }
  }

  const readNotes = (): Promise<boolean> => {
    setSyncStep({ phase: "running" })
    return new Promise((resolve) => {
      let ended = false
      const end = (step: SyncStep) => {
        ended = true
        setSyncStep(step)
        resolve(step.phase === "done")
      }
      platform
        .notesSync(tool.id, (e) => {
          if (e.event === "done") end({ phase: "done", summary: e.summary })
          else if (e.event === "failed") end({ phase: "failed", problem: syncProblem(e) })
          else if (e.event === "stopped") end({ phase: "idle" })
        })
        .catch(() => !ended && end({ phase: "failed", problem: "other" }))
    })
  }

  const downloadModel = () => {
    setModelStep({ phase: "downloading" })
    platform
      .notesModelDownload(tool.id, (e) => {
        if (e.event === "stopped") return setModelStep({ phase: "stopped" })
        if (e.event === "failed") return setModelStep({ phase: "failed", problem: e.problem })
        setModelStep({ phase: "preparing" })
        // Memo reads notes into the model's vectors on the next notes sync, so the card runs it for the owner.
        readNotes().then((ok) => {
          setModelStep(ok ? { phase: "done" } : { phase: "idle" })
          load()
        })
      })
      .catch(() => setModelStep({ phase: "failed", problem: "other" }))
  }

  const ready = setup?.state === "ready" ? setup : null
  const folders = ready?.folders ?? []
  const model = ready?.model ?? null
  const working = folderStep.phase === "picking" || folderStep.phase === "adding" || syncStep.phase === "running"
  const downloading = modelStep.phase === "downloading" || modelStep.phase === "preparing"

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId} className="text-[1.02rem] font-semibold text-ink">
        {m.title}
      </h4>
      <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.what}</p>
      {setup === null && loadError === null && <Skeleton className="h-[6rem] w-full max-w-[40rem]" />}
      {loadError !== null && <ErrorNotice inline>{m.loadFailed(loadError)}</ErrorNotice>}
      {setup?.state === "noMemo" && <p className="text-[0.9rem] text-ink-soft">{m.noMemo}</p>}
      {setup?.state === "old" && <p className="text-[0.9rem] text-ink-soft">{m.old(setup.version, setup.need)}</p>}
      {ready && (
        <ol className="flex max-w-[44rem] flex-col gap-5">
          <FolderStepView
            m={m}
            folders={folders}
            step={folderStep}
            disabled={working || downloading}
            onPick={pickFolder}
          />
          <Step n={2} m={m} title={m.syncTitle} done={syncStep.phase === "done"} what={m.syncWhat}>
            <SyncStepView
              m={m}
              step={syncStep}
              hasFolder={folders.length > 0}
              disabled={working || downloading}
              onStart={readNotes}
              onPick={pickFolder}
            />
          </Step>
          {model && (
            <Step
              n={3}
              m={m}
              title={m.modelTitle}
              done={model.downloaded}
              what={m.modelWhat(megabytes(model.sizeBytes))}
            >
              <ModelStepView
                m={m}
                model={model}
                step={modelStep}
                disabled={working}
                onStart={downloadModel}
                onStop={() => platform.notesModelStop(tool.id)}
              />
            </Step>
          )}
        </ol>
      )}
    </section>
  )
}

function Step(props: {
  n: number
  m: NotesSetupText
  title: string
  what: string
  done: boolean
  children: ReactNode
}) {
  const { n, title, what, done, children } = props
  return (
    <li className="grid grid-cols-[1.6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
      <span
        aria-hidden
        className={`grid size-[1.6rem] place-items-center rounded-full text-[0.8rem] font-semibold transition-colors duration-(--motion-slow) ${done ? "bg-ok text-on-status" : "bg-app-3 text-ink-soft"}`}
      >
        {done ? <Check className="check-in size-4" strokeWidth={3} aria-hidden /> : n}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <h5 className="font-semibold text-ink">{title}</h5>
        <p className="text-[0.9rem] leading-relaxed text-ink-soft">{what}</p>
        {children}
      </div>
    </li>
  )
}

function Problem({ m, problem, action }: { m: NotesSetupText; problem: NotesProblem | null; action: ReactNode }) {
  return (
    <Collapse open={problem !== null}>
      <ErrorNotice inline action={action}>
        {problem && m.problem[problem]}
      </ErrorNotice>
    </Collapse>
  )
}

function FolderStepView(props: {
  m: NotesSetupText
  folders: NotesFolder[]
  step: FolderStep
  disabled: boolean
  onPick: () => void
}) {
  const { m, folders, step, disabled, onPick } = props
  const busy = step.phase === "picking" || step.phase === "adding"
  return (
    <Step n={1} m={m} title={m.folderTitle} done={folders.length > 0} what={m.folderWhat}>
      <ul aria-label={m.foldersLabel} className="flex flex-col gap-1 text-[0.9rem]">
        {folders.length === 0 && <li className="text-ink-dim">{m.noFolder}</li>}
        {folders.map((f) => (
          <li key={f.id} className="selectable font-mono text-ink">
            {f.path}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant={folders.length === 0 ? "primary" : "secondary"} disabled={disabled} onClick={onPick}>
          {folders.length === 0 ? m.choose : m.chooseAnother}
        </Button>
        {busy && (
          <span className="text-[0.9rem] text-ink-dim" aria-live="polite">
            {step.phase === "picking" ? m.picking : m.adding}
          </span>
        )}
        {step.phase === "added" && (
          <span className="text-[0.9rem] text-ink-soft" aria-live="polite">
            {m.folderAdded(step.name)}
          </span>
        )}
      </div>
      <Problem
        m={m}
        problem={step.phase === "failed" ? step.problem : null}
        action={
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onPick}>
            {m.chooseOther}
          </Button>
        }
      />
      <p className="text-[0.85rem] text-ink-dim">{m.noRemove}</p>
    </Step>
  )
}

function SyncStepView(props: {
  m: NotesSetupText
  step: SyncStep
  hasFolder: boolean
  disabled: boolean
  onStart: () => void
  onPick: () => void
}) {
  const { m, step, hasFolder, disabled, onStart, onPick } = props
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={hasFolder && step.phase !== "done" ? "primary" : "secondary"}
          disabled={!hasFolder || disabled}
          onClick={onStart}
        >
          {step.phase === "done" ? m.syncAgain : m.syncStart}
        </Button>
        {!hasFolder && <span className="text-[0.9rem] text-ink-dim">{m.syncNeedsFolder}</span>}
      </div>
      <Collapse open={step.phase === "running"}>
        <div className="flex max-w-[28rem] flex-col gap-1.5" aria-live="polite">
          <ProgressBar label={m.syncLabel} value={null} size="thin" />
          <span className="text-[0.875rem] text-ink-dim">{m.syncRunning}</span>
        </div>
      </Collapse>
      <Collapse open={step.phase === "done"}>
        {step.phase === "done" && (
          <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
            {m.syncDone(step.summary.new, step.summary.failed)} {m.searchNow}
          </p>
        )}
      </Collapse>
      <Problem
        m={m}
        problem={step.phase === "failed" ? step.problem : null}
        action={
          step.phase === "failed" && step.problem === "folderUnreadable" ? (
            <Button size="sm" variant="secondary" disabled={disabled} onClick={onPick}>
              {m.chooseOther}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={disabled} onClick={onStart}>
              {m.tryAgain}
            </Button>
          )
        }
      />
    </>
  )
}

function ModelStepView(props: {
  m: NotesSetupText
  model: NotesModel
  step: ModelStep
  disabled: boolean
  onStart: () => void
  onStop: () => void
}) {
  const { m, model, step, disabled, onStart, onStop } = props
  const mb = megabytes(model.sizeBytes)
  const downloading = step.phase === "downloading"
  const preparing = step.phase === "preparing"
  return (
    <>
      {!model.downloaded && !preparing && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" disabled={disabled || downloading} onClick={onStart}>
            {m.modelStart(mb)}
          </Button>
          {downloading && (
            <Button size="sm" variant="ghost" onClick={onStop}>
              {m.modelCancel}
            </Button>
          )}
        </div>
      )}
      <Collapse open={downloading || preparing}>
        <div className="flex max-w-[28rem] flex-col gap-1.5" aria-live="polite">
          <ProgressBar label={m.modelLabel} value={null} size="thin" />
          <span className="text-[0.875rem] text-ink-dim">{preparing ? m.modelPreparing : m.modelRunning(mb)}</span>
        </div>
      </Collapse>
      <Collapse open={step.phase === "stopped"}>
        <p className="text-[0.9rem] text-ink-soft">{m.modelStopped}</p>
      </Collapse>
      <Collapse open={model.downloaded}>
        <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
          {step.phase === "done" ? m.modelDone : m.modelReady}
        </p>
      </Collapse>
      <Problem
        m={m}
        problem={step.phase === "failed" ? step.problem : null}
        action={
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onStart}>
            {m.tryAgain}
          </Button>
        }
      />
    </>
  )
}
