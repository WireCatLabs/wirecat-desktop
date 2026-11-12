import { FolderClosed, Plus, X } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { ChosenFolder } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { DriveFolderPicker } from "./DriveFolderPicker"
import { driveMessages } from "./messages-drive"
import { SyncButton, useSyncControl } from "./Sync"

type Chosen = { state: "loading" } | { state: "ready"; folders: ChosenFolder[] } | { state: "failed"; message: string }

/**
 * One Drive account's folders, any time after its sign-in: what drive's `folders list` holds, each with Remove
 * (`folders remove`), and the picker to add more. A change takes effect on the next sync, so Sync now follows it.
 */
export function DriveFoldersSettings(props: { tool: CatalogTool; profile: string; onClose: () => void }) {
  const { tool, profile, onClose } = props
  const m = useMessages(driveMessages).folders
  const heading = useId()
  const [chosen, setChosen] = useState<Chosen>({ state: "loading" })
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const sync = useSyncControl(tool, profile)

  const load = useCallback(async () => {
    try {
      const r = await platform.driveFoldersChosen(tool.id, profile)
      setChosen(
        r.result === "listed" ? { state: "ready", folders: r.folders } : { state: "failed", message: r.message },
      )
    } catch (e) {
      setChosen({ state: "failed", message: errorText(e) })
    }
  }, [tool.id, profile])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (f: ChosenFolder) => {
    setBusy(f.id)
    setRefused(null)
    const name = f.name ?? f.id
    try {
      const r = await platform.driveFolderRemove(tool.id, profile, f.id)
      if (r.result === "removed") {
        setChanged(true)
        await load()
      } else setRefused(m.removeFailed(name, r.message))
    } catch (e) {
      setRefused(m.removeFailed(name, errorText(e)))
    }
    setBusy(null)
  }

  return (
    <section
      aria-labelledby={heading}
      className="reveal flex flex-col gap-3 rounded-inset border border-line bg-app-2/60 p-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h5 id={heading} className="text-[0.95rem] font-semibold text-ink">
            {m.title(profile)}
          </h5>
          <p className="max-w-[65ch] text-[0.9rem] leading-snug text-ink-soft">{m.what}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label={m.close}
          title={m.close}
          icon={<X className="size-4" aria-hidden />}
        />
      </div>

      <AutoHeight swap={chosen.state}>
        {chosen.state === "loading" ? (
          <Skeleton className="h-10 w-full" />
        ) : chosen.state === "failed" ? (
          <ErrorNotice
            raw={chosen.message}
            inline
            action={
              <Button size="sm" variant="secondary" onClick={load}>
                {m.retry}
              </Button>
            }
          >
            {m.listFailed}
          </ErrorNotice>
        ) : chosen.folders.length === 0 ? (
          <p className="text-[0.9rem] font-medium text-ink">{m.none}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-button border border-line bg-app">
            {chosen.folders.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-1.5">
                <FolderClosed className="size-4 shrink-0 text-ink-dim" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ink">{f.name ?? m.notSynced}</span>
                  {!f.name && <code className="truncate font-mono text-[0.8rem] text-ink-dim">{f.id}</code>}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  aria-label={m.removeNamed(f.name ?? f.id)}
                  onClick={() => remove(f)}
                >
                  {busy === f.id ? m.removingNow : m.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AutoHeight>
      <Collapse open={refused !== null}>
        <ErrorNotice inline>{refused}</ErrorNotice>
      </Collapse>

      <p className="max-w-[65ch] text-[0.85rem] leading-snug text-ink-soft">
        {m.removing} {m.next}
      </p>

      <Collapse open={changed && sync.run?.phase !== "running"}>
        <div className="flex flex-wrap items-center gap-3 rounded-control bg-brand-soft/60 px-3 py-2">
          <p role="status" className="min-w-0 flex-1 text-[0.9rem] text-ink">
            {m.changed}
          </p>
          <SyncButton c={sync} />
        </div>
      </Collapse>

      <AutoHeight swap={adding}>
        {adding ? (
          <div className="flex flex-col gap-2">
            <DriveFolderPicker
              tool={tool.id}
              profile={profile}
              titled={false}
              failed={(level, retry) => (
                <ErrorNotice
                  inline
                  action={
                    <Button size="sm" variant="secondary" onClick={retry}>
                      {m.retry}
                    </Button>
                  }
                >
                  {level.message}
                </ErrorNotice>
              )}
              onAdded={() => {
                setChanged(true)
                void load()
              }}
            />
            <div>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                {m.doneAdding}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAdding(true)}
              icon={<Plus className="size-4" aria-hidden />}
            >
              {m.add}
            </Button>
          </div>
        )}
      </AutoHeight>
    </section>
  )
}
