import { Check } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import type { SyncSummary } from "@/domain/sync"
import { useMessages } from "@/i18n"
import type { NotesFolder, NotesModel, NotesProblem, NotesSetup, ObsidianVault } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { ExtLink } from "@/shared/ExtLink"
import { errorText } from "@/shared/errors"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { ProgressBar } from "@/ui/ProgressBar"
import { Skeleton } from "@/ui/Skeleton"
import { type NotesSetupText, notesSetupMessages } from "./messages-notes-setup"
import { searchModelMessages } from "./messages-search-model"
import { megabytes, syncProblem } from "./notes-setup"

type FolderStep =
  | { phase: "idle" }
  | { phase: "picking" | "adding" }
  | { phase: "added"; name: string; format: string; vault: boolean }
  | Failed
type Count = { done: number; total: number; label: string | null }
type RemoveStep =
  | { phase: "idle" | "removing" }
  | { phase: "removed"; name: string; deleted: boolean; notes: number | null }
  | Failed
type SyncStep =
  | { phase: "idle" }
  | { phase: "running"; count?: Count }
  | { phase: "done"; summary: SyncSummary }
  | Failed
type ModelStep =
  | { phase: "idle" | "stopped" | "done" | "switching" }
  | { phase: "downloading" | "preparing"; model: string; count?: Count }
  | { phase: "switched"; minutes: number | null }
  | (Failed & { model: string })
type Failed = { phase: "failed"; problem: NotesProblem }

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
  const [removeStep, setRemoveStep] = useState<RemoveStep>({ phase: "idle" })
  const [confirming, setConfirming] = useState<NotesFolder | null>(null)

  const load = useCallback(() => {
    let current = true
    platform.notesSetupStatus(tool.id).then(
      (s) => current && setSetup(s),
      (e) => current && setLoadError(errorText(e)),
    )
    return () => {
      current = false
    }
  }, [tool.id])
  useEffect(load, [load])

  /** Rust picks the format: `obsidian` for a folder in a vault, `markdown` otherwise. */
  const addFolder = async (path: string, vault: boolean) => {
    setFolderStep({ phase: "adding" })
    const answer = await platform.notesFolderAdd(tool.id, path)
    if (answer.result === "failed") return setFolderStep({ phase: "failed", problem: answer.problem })
    setFolderStep({ phase: "added", name: answer.folder.name, format: answer.folder.format, vault })
    setSyncStep({ phase: "idle" })
    load()
  }

  const pick = async (vault: boolean) => {
    setFolderStep({ phase: "picking" })
    try {
      const path = await platform.notesPickFolder()
      if (path === null) return setFolderStep({ phase: "idle" })
      await addFolder(path, vault)
    } catch {
      setFolderStep({ phase: "failed", problem: "other" })
    }
  }
  const pickFolder = () => pick(false)

  const connectVault = (vault: ObsidianVault) =>
    addFolder(vault.path, true).catch(() => setFolderStep({ phase: "failed", problem: "other" }))

  const removeFolder = async (folder: NotesFolder, deleteNotes: boolean) => {
    setRemoveStep({ phase: "removing" })
    try {
      const answer = await platform.notesFolderRemove(tool.id, folder.id, deleteNotes)
      if (answer.result === "failed") return setRemoveStep({ phase: "failed", problem: answer.problem })
      setRemoveStep({ phase: "removed", name: folder.name, deleted: deleteNotes, notes: answer.notesDeleted })
      setSyncStep({ phase: "idle" })
      load()
    } catch {
      setRemoveStep({ phase: "failed", problem: "other" })
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
          else if (e.event === "counted" && !ended) setSyncStep({ phase: "running", count: e })
        })
        .catch(() => !ended && end({ phase: "failed", problem: "other" }))
    })
  }

  const download = (model: string): Promise<boolean> =>
    new Promise((resolve) => {
      setModelStep({ phase: "downloading", model })
      platform
        .notesModelDownload(tool.id, model, (e) => {
          if (e.event === "counted") return setModelStep({ phase: "downloading", model, count: e })
          if (e.event === "stopped") {
            setModelStep({ phase: "stopped" })
            return resolve(false)
          }
          if (e.event === "failed") {
            setModelStep({ phase: "failed", model, problem: e.problem })
            return resolve(false)
          }
          resolve(true)
        })
        .catch(() => {
          setModelStep({ phase: "failed", model, problem: "other" })
          resolve(false)
        })
    })

  /** The model in use, not downloaded yet: after the download the card reads the notes into its vectors. */
  const downloadInUse = async (model: NotesModel) => {
    if (!(await download(model.id))) return
    setModelStep({ phase: "preparing", model: model.id })
    const ok = await readNotes()
    setModelStep(ok ? { phase: "done" } : { phase: "idle" })
    load()
  }

  /** Another model: downloaded first when needed, then memo's `models set`; the next syncs embed what it lacks. */
  const switchTo = async (model: NotesModel) => {
    if (!model.downloaded && !(await download(model.id))) return
    setModelStep({ phase: "switching" })
    try {
      const used = await platform.notesModelUse(tool.id, model.id)
      if (used.result === "failed") setModelStep({ phase: "failed", model: model.id, problem: used.problem })
      else
        setModelStep({
          phase: "switched",
          minutes: used.estimateSeconds === null ? null : Math.ceil(used.estimateSeconds / 60),
        })
    } catch {
      setModelStep({ phase: "failed", model: model.id, problem: "other" })
    }
    load()
  }

  const ready = setup?.state === "ready" ? setup : null
  const folders = ready?.folders ?? []
  const models = ready?.models ?? []
  const vaults = ready?.vaults ?? []
  const working = folderStep.phase === "picking" || folderStep.phase === "adding" || syncStep.phase === "running"
  const downloading = ["downloading", "preparing", "switching"].includes(modelStep.phase)

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
      {loadError !== null && (
        <ErrorNotice raw={loadError} inline>
          {m.loadFailed}
        </ErrorNotice>
      )}
      {setup?.state === "noMemo" && <p className="text-[0.9rem] text-ink-soft">{m.noMemo}</p>}
      {setup?.state === "old" && <p className="text-[0.9rem] text-ink-soft">{m.old(setup.version, setup.need)}</p>}
      {ready && (
        <ol className="flex max-w-[44rem] flex-col gap-5">
          <FolderStepView
            m={m}
            folders={folders}
            vaults={vaults}
            step={folderStep}
            removal={removeStep}
            disabled={working || downloading}
            onPick={pickFolder}
            onPickVault={() => pick(true)}
            onConnect={connectVault}
            onRemove={(f) => removeFolder(f, false)}
            onRemoveDelete={setConfirming}
          />
          <Step n={2} m={m} title={m.syncTitle} done={syncStep.phase === "done"} what={m.syncWhat}>
            <SyncStepView
              m={m}
              step={syncStep}
              folders={folders}
              disabled={working || downloading}
              onStart={readNotes}
              onPick={pickFolder}
            />
          </Step>
          {models.length > 0 && (
            <Step
              n={3}
              m={m}
              title={m.modelTitle}
              done={models.some((x) => x.inUse && x.downloaded)}
              what={m.modelWhat}
            >
              <ModelStepView
                m={m}
                models={models}
                step={modelStep}
                disabled={working}
                onDownload={downloadInUse}
                onSwitch={switchTo}
                onStop={() => platform.notesModelStop(tool.id)}
              />
            </Step>
          )}
        </ol>
      )}
      <Dialog
        open={confirming !== null}
        title={confirming ? m.confirmTitle(confirming.name) : ""}
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button variant="secondary" data-autofocus onClick={() => setConfirming(null)}>
              {m.confirmCancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirming) removeFolder(confirming, true)
                setConfirming(null)
              }}
            >
              {m.confirmDelete}
            </Button>
          </>
        }
      >
        <p>{confirming ? m.confirmWhat(confirming.path ?? confirming.name) : ""}</p>
      </Dialog>
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
  vaults: ObsidianVault[]
  step: FolderStep
  removal: RemoveStep
  disabled: boolean
  onPick: () => void
  onPickVault: () => void
  onConnect: (vault: ObsidianVault) => void
  onRemove: (folder: NotesFolder) => void
  onRemoveDelete: (folder: NotesFolder) => void
}) {
  const { m, folders, vaults, step, removal, disabled, onPick, onPickVault, onConnect, onRemove, onRemoveDelete } =
    props
  const busy = step.phase === "picking" || step.phase === "adding"
  return (
    <Step n={1} m={m} title={m.folderTitle} done={folders.length > 0} what={m.folderWhat}>
      <ul aria-label={m.foldersLabel} className="flex flex-col gap-1 text-[0.9rem]">
        {folders.length === 0 && <li className="text-ink-dim">{m.noFolder}</li>}
        {folders.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="selectable min-w-0 break-all font-mono text-ink">{f.path}</span>
            <Pill tone={f.format === "obsidian" ? "brand" : "neutral"}>{m.format(f.format)}</Pill>
            <span className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={m.removeKeepFor(f.name)}
                disabled={disabled || removal.phase === "removing"}
                onClick={() => onRemove(f)}
              >
                {m.removeKeep}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={m.removeDeleteFor(f.name)}
                disabled={disabled || removal.phase === "removing"}
                onClick={() => onRemoveDelete(f)}
              >
                {m.removeDelete}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <Collapse open={vaults.length > 0}>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.9rem] font-medium text-ink">{m.vaultsFound}</span>
          <ul aria-label={m.vaultsFound} className="flex flex-col gap-1 text-[0.9rem]">
            {vaults.map((v) => (
              <li key={v.path} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-ink">{v.name}</span>
                <span className="selectable min-w-0 break-all font-mono text-ink-soft">{v.shown}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={m.connectVaultFor(v.name)}
                  disabled={disabled}
                  onClick={() => onConnect(v)}
                >
                  {m.connectVault}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Collapse>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant={folders.length === 0 ? "primary" : "secondary"} disabled={disabled} onClick={onPick}>
          {folders.length === 0 ? m.choose : m.chooseAnother}
        </Button>
        <Button size="sm" variant="secondary" disabled={disabled} onClick={onPickVault}>
          {m.chooseVault}
        </Button>
        {busy && (
          <span className="text-[0.9rem] text-ink-dim" aria-live="polite">
            {step.phase === "picking" ? m.picking : m.adding}
          </span>
        )}
        {step.phase === "added" && (
          <span className="text-[0.9rem] text-ink-soft" aria-live="polite">
            {m.folderAdded(step.name, step.format, step.vault)}
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
      <Collapse open={removal.phase === "removing" || removal.phase === "removed"}>
        <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
          {removal.phase === "removed"
            ? removal.deleted
              ? m.removedDeleted(removal.name, removal.notes)
              : m.removedKept(removal.name)
            : m.removing}
        </p>
      </Collapse>
      <Problem m={m} problem={removal.phase === "failed" ? removal.problem : null} action={null} />
    </Step>
  )
}

function SyncStepView(props: {
  m: NotesSetupText
  step: SyncStep
  folders: NotesFolder[]
  disabled: boolean
  onStart: () => void
  onPick: () => void
}) {
  const { m, step, folders, disabled, onStart, onPick } = props
  const hasFolder = folders.length > 0
  const count = step.phase === "running" ? step.count : undefined
  const folder = folders.find((f) => f.id === count?.label)?.name ?? null
  const text = count && count.total > 0 ? m.syncCount(count.done, count.total, folder) : m.syncRunning
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
          <ProgressBar
            label={m.syncLabel}
            value={count && count.total > 0 ? count.done : null}
            max={count?.total ?? 100}
            valueText={text}
            size="thin"
          />
          <span className="text-[0.875rem] text-ink-dim">{text}</span>
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

function ModelName({ model, m }: { model: NotesModel; m: NotesSetupText }) {
  const s = useMessages(searchModelMessages)
  if (model.role === "recommended") {
    const word = model.terms ? (
      <ExtLink href={model.terms} className="font-medium">
        {s.modelWord}
      </ExtLink>
    ) : (
      s.modelWord
    )
    return <>{s.best(word)}</>
  }
  return <>{model.role === "alternative" ? m.modelLighter : model.title}</>
}

function ModelStepView(props: {
  m: NotesSetupText
  models: NotesModel[]
  step: ModelStep
  disabled: boolean
  onDownload: (model: NotesModel) => void
  onSwitch: (model: NotesModel) => void
  onStop: () => void
}) {
  const { m, models, step, disabled, onDownload, onSwitch, onStop } = props
  const busy = ["downloading", "preparing", "switching"].includes(step.phase)
  const target = "model" in step ? models.find((x) => x.id === step.model) : undefined
  const mb = target ? megabytes(target.sizeBytes) : 0
  const count = step.phase === "downloading" && step.count?.total ? step.count : undefined
  const text =
    step.phase === "preparing"
      ? m.modelPreparing
      : count
        ? m.modelCount(megabytes(count.done), megabytes(count.total))
        : m.modelRunning(mb)
  const inUseReady = models.some((x) => x.inUse && x.downloaded)
  const retry = target?.inUse ? () => onDownload(target) : target ? () => onSwitch(target) : undefined
  return (
    <>
      <ul aria-label={m.modelsLabel} className="grid gap-2 sm:grid-cols-2">
        {models.map((model) => (
          <li
            key={model.id}
            className={`flex flex-col gap-2 rounded-control border px-3 py-2.5 transition-colors duration-(--motion-slow) ${model.inUse ? "border-brand bg-brand-soft" : "border-line-strong"}`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.95rem] font-medium text-ink">
                <ModelName model={model} m={m} />
              </span>
              <span className="flex items-center gap-2 text-[0.8rem] text-ink-soft tabular-nums">
                {m.modelSize(megabytes(model.sizeBytes))}
                {model.inUse && <Pill tone="brand">{m.inUse}</Pill>}
              </span>
            </div>
            {!(model.inUse && model.downloaded) && (
              <div>
                <Button
                  size="sm"
                  variant={model.role === "recommended" && !inUseReady ? "primary" : "secondary"}
                  disabled={disabled || busy}
                  onClick={() => (model.inUse ? onDownload(model) : onSwitch(model))}
                >
                  {model.inUse
                    ? m.modelStart(megabytes(model.sizeBytes))
                    : model.downloaded
                      ? m.useModel
                      : m.downloadAndUse(megabytes(model.sizeBytes))}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Collapse open={step.phase === "downloading" || step.phase === "preparing"}>
        <div className="flex max-w-[28rem] flex-col gap-1.5" aria-live="polite">
          <ProgressBar
            label={m.modelLabel}
            value={count ? count.done : null}
            max={count?.total ?? 100}
            valueText={text}
            size="thin"
          />
          <div className="flex items-center gap-3">
            <span className="text-[0.875rem] text-ink-dim">{text}</span>
            {step.phase === "downloading" && (
              <Button size="sm" variant="secondary" onClick={onStop}>
                {m.modelCancel}
              </Button>
            )}
          </div>
        </div>
      </Collapse>
      <Collapse open={step.phase === "switching" || step.phase === "switched" || step.phase === "stopped"}>
        <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
          {step.phase === "switching"
            ? m.switching
            : step.phase === "switched"
              ? m.switched(step.minutes)
              : step.phase === "stopped"
                ? m.modelStopped
                : ""}
        </p>
      </Collapse>
      <Collapse open={step.phase === "done" || (inUseReady && step.phase === "idle")}>
        <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
          {step.phase === "done" ? m.modelDone : m.modelReady}
        </p>
      </Collapse>
      <Problem
        m={m}
        problem={step.phase === "failed" ? step.problem : null}
        action={
          retry && (
            <Button size="sm" variant="secondary" disabled={disabled} onClick={retry}>
              {m.tryAgain}
            </Button>
          )
        }
      />
    </>
  )
}
