import { ChevronRight, FolderClosed, HardDrive, LoaderCircle, Users } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import type { DriveFolder, FolderLevel } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { useFieldError } from "@/ui/FieldError"
import { driveMessages } from "./messages-drive"

/** "Shared with me" is a list, not a folder: drive-cli refuses to add it, only what is under it. */
const SHARED_WITH_ME = "shared_with_me"

type Crumb = { id: string | null; name: string }
export type FailedLevel = Extract<FolderLevel, { result: "failed" }>
type Level = { state: "loading" } | { state: "ready"; level: FolderLevel }

/**
 * After Drive signs in: the owner's folders one level at a time (drive-cli PR #335's `folders browse`), ticked ones
 * added with `folders add`. A drive before that command fails the first level with `needs_update`, and the picker
 * says to update.
 */
export function DriveFolderPicker(props: {
  tool: string
  profile: string
  /** What a level that could not be read says, with a way to read it again. */
  failed: (level: FailedLevel, retry: () => void) => ReactNode
  /** The next step once a folder is added, such as Sync now. */
  after?: ReactNode
  onAdded?: () => void
  /** Off where the surface around it already has the title. */
  titled?: boolean
}) {
  const { tool, profile, failed, after, onAdded, titled = true } = props
  const sm = useMessages(driveMessages)
  const heading = useId()
  const [trail, setTrail] = useState<Crumb[]>([{ id: null, name: sm.picker.root }])
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [notAdded, setNotAdded] = useState<string[]>([])
  const list = useRef<HTMLUListElement>(null)
  const listId = `${heading}-list`
  const none = useFieldError(listId)
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
          [k]: { state: "ready", level: { result: "failed", message: errorText(e), code: null, reason: null } },
        })),
    )
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: each level is read once, when it is first opened
  useEffect(() => {
    if (!levels[key]) load(here)
  }, [key])

  const open = (folder: DriveFolder) => setTrail((t) => [...t, { id: folder.id, name: folder.name }])
  const back = (to: number) => setTrail((t) => t.slice(0, to + 1))
  const toggle = (folder: DriveFolder, on: boolean) => {
    none.clear()
    setChosen((c) => {
      const next = new Map(c)
      if (on) next.set(folder.id, folder.name)
      else next.delete(folder.id)
      return next
    })
  }

  const add = async () => {
    if (chosen.size === 0) return none.fail(sm.picker.noneChosen)
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
    if (done.length > 0) onAdded?.()
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
      {titled ? (
        <div className="flex flex-col gap-1">
          <h3 id={heading} className="text-[1.15rem] font-semibold text-ink">
            {sm.picker.title}
          </h3>
          <p className="text-body leading-snug text-ink-soft">{sm.picker.lead}</p>
        </div>
      ) : (
        <h3 id={heading} className="sr-only">
          {sm.picker.title}
        </h3>
      )}
      <nav aria-label={sm.picker.trail}>
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
              {sm.picker.loading}
            </p>
          ) : level.level.result === "failed" ? (
            failed(level.level, () => load(here))
          ) : (
            <div className="flex flex-col gap-2">
              {level.level.partial && <p className="text-[0.9rem] text-ink-soft">{sm.picker.partial}</p>}
              {level.level.folders.length === 0 ? (
                <p className="py-3 text-ink-soft">{sm.picker.empty}</p>
              ) : (
                <ul
                  ref={list}
                  id={listId}
                  {...none.field}
                  onKeyDown={keys}
                  className="flex max-h-[18rem] flex-col overflow-y-auto rounded-button border border-line"
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
      {none.hint}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button size="sm" variant="primary" disabled={adding} onClick={add}>
          {adding ? sm.picker.adding : sm.picker.add(chosen.size)}
        </Button>
        {added.length > 0 && after}
      </div>
      <p role="status" className="min-h-[1.3rem] text-[0.95rem] text-ink-soft">
        {notAdded.length > 0 ? (
          <span className="text-bad">{sm.picker.notAdded(notAdded.join(", "))}</span>
        ) : added.length > 0 ? (
          sm.picker.done(added.length)
        ) : chosen.size > 0 ? (
          sm.picker.chosen(chosen.size)
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
  const sm = useMessages(driveMessages)
  const id = useId()
  const addable = folder.kind !== SHARED_WITH_ME
  const opens = folder.childFolders !== 0
  const Icon = folder.kind === "shared_drive" ? HardDrive : folder.kind === SHARED_WITH_ME ? Users : FolderClosed
  const detail =
    folder.kind === SHARED_WITH_ME
      ? sm.picker.sharedWithMe
      : [sm.picker.kind[folder.kind], added ? sm.picker.added : sm.picker.subfolders(folder.childFolders)]
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
          aria-label={sm.picker.open(folder.name)}
          title={sm.picker.open(folder.name)}
          onClick={onOpen}
          icon={<ChevronRight className="size-4" aria-hidden />}
        />
      )}
    </li>
  )
}
