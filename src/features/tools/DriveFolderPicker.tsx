import { ChevronRight, FolderClosed, HardDrive, LoaderCircle, Users } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { explainFailure } from "@/domain/signin-failure"
import { useMessages } from "@/i18n"
import type { DriveFolder, FolderLevel } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useSignIn } from "@/shared/signin-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { setupMessages } from "./messages-setup"
import { wizardMessages } from "./messages-wizard"
import { SyncNow } from "./ZoomApp"

/** "Shared with me" is a list, not a folder: drive-cli refuses to add it, only what is under it. */
const SHARED_WITH_ME = "shared_with_me"

type Crumb = { id: string | null; name: string }
type Level = { state: "loading" } | { state: "ready"; level: FolderLevel }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * After Drive signs in: the owner's folders one level at a time (drive-cli PR #335's `folders browse`), ticked ones
 * added with `folders add`. A drive before that command fails the first level with `needs_update`, and the picker
 * says to update.
 */
export function DriveFolders({ tool, profile, name }: { tool: string; profile: string; name: string }) {
  const sm = useMessages(setupMessages)
  const heading = useId()
  const [trail, setTrail] = useState<Crumb[]>([{ id: null, name: sm.drive.root }])
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [notAdded, setNotAdded] = useState<string[]>([])
  const list = useRef<HTMLUListElement>(null)
  const here = trail.at(-1)?.id ?? null
  const key = here ?? ""

  const load = (parent: string | null) => {
    const k = parent ?? ""
    setLevels((l) => ({ ...l, [k]: { state: "loading" } }))
    platform.driveFoldersBrowse(tool, profile, parent).then(
      (level) => setLevels((l) => ({ ...l, [k]: { state: "ready", level } })),
      (e) =>
        setLevels((l) => ({
          ...l,
          [k]: { state: "ready", level: { result: "failed", message: message(e), code: null, reason: null } },
        })),
    )
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: each level is read once, when it is first opened
  useEffect(() => {
    if (!levels[key]) load(here)
  }, [key])

  const open = (folder: DriveFolder) => setTrail((t) => [...t, { id: folder.id, name: folder.name }])
  const back = (to: number) => setTrail((t) => t.slice(0, to + 1))
  const toggle = (folder: DriveFolder, on: boolean) =>
    setChosen((c) => {
      const next = new Map(c)
      if (on) next.set(folder.id, folder.name)
      else next.delete(folder.id)
      return next
    })

  const add = async () => {
    setAdding(true)
    const failed: string[] = []
    const done: string[] = []
    for (const [id, folderName] of chosen) {
      const result = await platform
        .driveFolderAdd(tool, profile, id)
        .catch(() => ({ result: "failed" as const, message: "", code: null, reason: null }))
      if (result.result === "added") done.push(id)
      else failed.push(folderName)
    }
    setAdded((a) => [...a, ...done])
    setNotAdded(failed)
    setChosen((c) => new Map([...c].filter(([id]) => !done.includes(id))))
    setAdding(false)
  }

  // Up and down move between rows, right opens a folder, left goes back up: a tree's keys on a one-level list.
  const keys = (e: KeyboardEvent) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])]
    const at = rows.findIndex((r) => r.contains(document.activeElement))
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const next = rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))]
      next?.querySelector<HTMLElement>("input, button")?.focus()
    } else if (e.key === "ArrowRight") {
      rows[at]?.querySelector<HTMLElement>("[data-open]")?.click()
    } else if (e.key === "ArrowLeft" && trail.length > 1) {
      back(trail.length - 2)
    }
  }

  const level = levels[key]
  return (
    <section aria-labelledby={heading} className="flex w-full max-w-[34rem] flex-col gap-3 text-left">
      <div className="flex flex-col gap-1">
        <h3 id={heading} className="text-[1.15rem] font-semibold text-ink">
          {sm.drive.title}
        </h3>
        <p className="text-body leading-snug text-ink-soft">{sm.drive.lead}</p>
      </div>
      <nav aria-label={sm.drive.trail}>
        <ol className="flex flex-wrap items-center gap-1 text-[0.95rem]">
          {trail.map((crumb, i) => (
            <li key={crumb.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-4 text-ink-dim" aria-hidden />}
              {i === trail.length - 1 ? (
                <span aria-current="location" className="font-medium text-ink">
                  {crumb.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => back(i)}
                  className="rounded-[0.25rem] px-1 text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {crumb.name}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <AutoHeight swap={key}>
        <Crossfade swap={`${key}:${level?.state ?? "loading"}`}>
          {!level || level.state === "loading" ? (
            <p className="flex items-center gap-2 py-3 text-ink-soft">
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
              {sm.drive.loading}
            </p>
          ) : level.level.result === "failed" ? (
            <LevelFailed level={level.level} name={name} profile={profile} onRetry={() => load(here)} />
          ) : (
            <div className="flex flex-col gap-2">
              {level.level.partial && <p className="text-[0.9rem] text-ink-soft">{sm.drive.partial}</p>}
              {level.level.folders.length === 0 ? (
                <p className="py-3 text-ink-soft">{sm.drive.empty}</p>
              ) : (
                <ul
                  ref={list}
                  onKeyDown={keys}
                  className="flex max-h-[18rem] flex-col overflow-y-auto rounded-[0.4rem] border border-line"
                >
                  {level.level.folders.map((folder) => (
                    <Row
                      key={folder.id}
                      folder={folder}
                      checked={chosen.has(folder.id)}
                      added={folder.added || added.includes(folder.id)}
                      onToggle={(on) => toggle(folder, on)}
                      onOpen={() => open(folder)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </Crossfade>
      </AutoHeight>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button size="sm" variant="primary" disabled={chosen.size === 0 || adding} onClick={add}>
          {adding ? sm.drive.adding : sm.drive.add(chosen.size)}
        </Button>
        {added.length > 0 && <SyncNow tool={tool} profile={profile} />}
      </div>
      <p role="status" className="min-h-[1.3rem] text-[0.95rem] text-ink-soft">
        {notAdded.length > 0 ? (
          <span className="text-bad">{sm.drive.notAdded(notAdded.join(", "))}</span>
        ) : added.length > 0 ? (
          sm.drive.done(added.length)
        ) : chosen.size > 0 ? (
          sm.drive.chosen(chosen.size)
        ) : null}
      </p>
    </section>
  )
}

function Row({
  folder,
  checked,
  added,
  onToggle,
  onOpen,
}: {
  folder: DriveFolder
  checked: boolean
  added: boolean
  onToggle: (on: boolean) => void
  onOpen: () => void
}) {
  const sm = useMessages(setupMessages)
  const id = useId()
  const addable = folder.kind !== SHARED_WITH_ME
  const opens = folder.childFolders !== 0
  const Icon = folder.kind === "shared_drive" ? HardDrive : folder.kind === SHARED_WITH_ME ? Users : FolderClosed
  const detail =
    folder.kind === SHARED_WITH_ME
      ? sm.drive.sharedWithMe
      : [sm.drive.kind[folder.kind], added ? sm.drive.added : sm.drive.subfolders(folder.childFolders)]
          .filter(Boolean)
          .join(" · ")
  return (
    <li data-row className="flex items-center gap-3 border-line border-b px-3 py-2 last:border-b-0">
      {addable ? (
        <Checkbox
          id={id}
          checked={checked || added}
          disabled={added}
          onChange={onToggle}
          aria-describedby={`${id}-detail`}
        />
      ) : (
        <span className="size-[1.1rem] shrink-0" aria-hidden />
      )}
      <Icon className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        {addable ? (
          <label htmlFor={id} className={cx("truncate", added ? "text-ink-soft" : "cursor-pointer text-ink")}>
            {folder.name}
          </label>
        ) : (
          <span className="truncate text-ink">{folder.name}</span>
        )}
        <span id={`${id}-detail`} className="truncate text-[0.85rem] text-ink-soft">
          {detail}
        </span>
      </div>
      {opens && (
        <Button
          size="sm"
          variant="ghost"
          data-open
          aria-label={sm.drive.open(folder.name)}
          title={sm.drive.open(folder.name)}
          onClick={onOpen}
          icon={<ChevronRight className="size-4" aria-hidden />}
        />
      )}
    </li>
  )
}

function LevelFailed({
  level,
  name,
  profile,
  onRetry,
}: {
  level: Extract<FolderLevel, { result: "failed" }>
  name: string
  profile: string
  onRetry: () => void
}) {
  const wm = useMessages(wizardMessages)
  const sm = useMessages(setupMessages)
  const explained = explainFailure({
    tool: "drive",
    profile,
    message: level.message,
    code: level.code,
    reason: level.reason,
    at: null,
    otherMethod: false,
    terminal: false,
  })
  const text = wm.failure[explained.reason]
  const signInAgain = explained.reason === "signedOut" || explained.reason === "signInExpired"
  return (
    <ErrorNotice
      detail={<p>{text.cause(name)}</p>}
      action={
        explained.reason === "needsUpdate" ? undefined : signInAgain ? (
          <Button size="sm" variant="secondary" onClick={() => useSignIn.getState().again()}>
            {wm.actions.retry}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {sm.drive.retry}
          </Button>
        )
      }
    >
      <span className="font-medium">{text.title(name)}</span>
    </ErrorNotice>
  )
}
