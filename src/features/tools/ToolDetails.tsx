import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { type CatalogTool, installCommand, isOwn, ownerId, removeCommand, samePackage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { StorageFolder } from "@/platform/schemas"
import { KeptFolders } from "@/shared/KeptFolders"
import { useStorage } from "@/shared/storage-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { Enrichment } from "./Enrichment"
import { Health } from "./Health"
import { packageNamesOf } from "./InstallPanel"
import { MailAgent } from "./MailAgent"
import { McpServer } from "./McpServer"
import { MemoSetup } from "./MemoSetup"
import { type ToolsText, toolsMessages } from "./messages"
import { copiesMessages } from "./messages-copies"
import { Permissions } from "./Permissions"
import { type Copy, RemoveCopyDialog, removable } from "./RemoveCopy"
import { RemoveOwn } from "./RemoveOwn"
import { SearchHarder } from "./SearchHarder"
import { Service } from "./Service"
import { FitDetails } from "./StorageFit"
import { toolText } from "./tool-text"

function ConfirmUninstall({ tool, open, onClose }: { tool: CatalogTool; open: boolean; onClose: () => void }) {
  const installs = useTools((s) => s.installs[tool.id]) ?? []
  const copies = installs.length
  const shared = samePackage(tool.id).length > 1
  const [deleteData, setDeleteData] = useState(false)
  const data = useOwnData(tool, open)
  const m = useMessages(toolsMessages).uninstall
  const names = packageNamesOf(tool.id)
  const bytes = data.folders?.reduce((sum, f) => sum + f.bytes, 0) ?? 0
  const deleting = deleteData && (data.folders?.length ?? 0) > 0

  useEffect(() => {
    if (open) setDeleteData(false)
  }, [open])

  return (
    <Dialog
      open={open}
      title={m.title(names)}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} autoFocus>
            {m.keep}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose()
              useTools.getState().uninstall(tool.id, deleting ? bytes : undefined)
            }}
          >
            {deleting ? m.andDelete : m.uninstall}
          </Button>
        </>
      }
    >
      {shared && <p className="mb-2 font-medium text-ink">{m.together(names)}</p>}
      <p>{m.removes(<code className="font-mono text-ink">{tool.bin}</code>, copies)}</p>
      <p className="mt-2">{m.services}</p>
      <DeleteDataChoice tool={tool} data={data} bytes={bytes} checked={deleteData} onChange={setDeleteData} m={m} />
    </Dialog>
  )
}

type OwnData = { folders: StorageFolder[] | null; kept: string[]; error: string | null; sharedInUse: boolean }

/** The package's own folders as storage.rs computes them, and whether another installed tool keeps the shared store. */
function useOwnData(tool: CatalogTool, open: boolean): OwnData {
  const areas = useStorage((s) => s.areas)
  const error = useStorage((s) => s.error)
  const installs = useTools((s) => s.installs)
  useEffect(() => {
    if (open) useStorage.getState().load()
  }, [open])
  const owner = ownerId(tool.id)
  const mine = areas?.find((a) => a.id === owner)
  // From installs, known on the first frame, so the note never appears after the dialog has opened.
  const others = Object.entries(installs).some(([id, copies]) => copies.length > 0 && ownerId(id) !== owner)
  return {
    folders: mine ? mine.folders : null,
    kept: mine?.kept ?? [],
    error: mine ? null : error,
    sharedInUse: others,
  }
}

function DeleteDataChoice(props: {
  tool: CatalogTool
  data: OwnData
  bytes: number
  checked: boolean
  onChange(v: boolean): void
  m: ToolsText["uninstall"]
}) {
  const { tool, data, bytes, checked, onChange, m } = props
  const kinds = useMessages(toolsMessages).details.kind
  const name = samePackage(tool.id).length > 1 ? packageNamesOf(tool.id) : tool.name
  const none = data.folders !== null && data.folders.length === 0
  return (
    <div className="mt-4 border-line border-t pt-3">
      <label className="flex items-start gap-2.5 text-ink">
        <Checkbox
          checked={checked && !none}
          disabled={data.folders === null || none}
          onChange={onChange}
          className="mt-[0.3rem]"
        />
        <span>
          {m.alsoDelete(name)}
          <span className="block text-[0.9rem] text-ink-soft">{none ? m.noData : m.dataWhat}</span>
        </span>
      </label>
      {data.sharedInUse && <p className="mt-2 ml-[1.6rem] text-[0.9rem] text-ink-soft">{m.sharedStays}</p>}
      {/* Room for three folders and the total, so the centred dialog keeps its buttons in place when they arrive. */}
      <div className="mt-2 ml-[1.6rem] min-h-[6rem]">
        {data.folders === null ? (
          data.error ? (
            <ErrorNotice inline>{m.foldersFailed(data.error)}</ErrorNotice>
          ) : (
            <Skeleton className="h-[6rem] w-full" label={m.readingFolders} />
          )
        ) : (
          !none && (
            <ul className="flex flex-col gap-1 text-[0.9rem]" aria-label={m.folders(name)}>
              {data.folders.map((f) => (
                <li key={f.path} className="flex flex-wrap items-baseline gap-x-2">
                  <code className="selectable min-w-0 break-all font-mono text-ink">{f.path}</code>
                  <span className="text-ink-dim tabular-nums">
                    {kinds[f.kind] ?? f.kind} · {formatBytes(f.bytes)}
                  </span>
                </li>
              ))}
              {data.folders.length > 1 && <li className="text-ink-soft tabular-nums">{m.inAll(formatBytes(bytes))}</li>}
            </ul>
          )
        )}
        <KeptFolders paths={data.kept} />
      </div>
    </div>
  )
}

export function ToolDetails({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id]) ?? []
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState<Copy | null>(null)
  const t = useMessages(toolsMessages)
  const m = t.details

  return (
    <div className="grid gap-x-[2.4rem] gap-y-6 border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Collapse open={installs.length > 1} frameClassName="lg:col-span-2">
        <ExtraCopies tool={tool} installs={installs} onRemove={setRemoving} />
      </Collapse>
      {installs.length > 0 ? (
        <Health tool={tool} />
      ) : (
        <p className="text-[0.95rem] text-ink-soft">{m.installFirst(tool.name)}</p>
      )}
      <section aria-label={m.about(tool.name)} className="flex flex-col gap-4">
        <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{toolText(t, tool).summary}</p>
        <div className="flex gap-5">
          <ExternalLinkButton href={tool.docs}>{m.docs}</ExternalLinkButton>
          {tool.repo && <ExternalLinkButton href={tool.repo}>{m.github}</ExternalLinkButton>}
        </div>
        <div>
          <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{m.installFromTerminal}</h4>
          <CopyField value={installCommand(tool)} label={m.copyInstall} />
        </div>
        <div>
          <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{m.installedAt}</h4>
          {installs.length === 0 && <p className="text-[0.875rem] text-ink-soft">{m.notInstalledHere}</p>}
          <ul className="flex flex-col gap-1.5">
            {installs.map((i, n) => (
              <li key={i.path} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]">
                <code className="selectable min-w-0 truncate font-mono text-ink">{i.path}</code>
                <span className="text-ink-dim">
                  {i.version ?? m.doesNotStart} · {i.manager}
                </span>
                {installs.length > 1 &&
                  (n === 0 ? <Pill tone="brand">{m.runsFirst}</Pill> : <Pill tone="warn">{m.notUsed}</Pill>)}
              </li>
            ))}
          </ul>
        </div>
        {installs.length > 0 && <FitDetails id={tool.id} />}
        {installs.length > 0 && (
          <div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setConfirming(true)}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              {m.uninstall}
            </Button>
          </div>
        )}
        {isOwn(tool) && (
          <RemoveOwn tool={tool} installed={installs.length > 0} onUninstall={() => setConfirming(true)} />
        )}
      </section>
      <ConfirmUninstall tool={tool} open={confirming} onClose={() => setConfirming(false)} />
      <RemoveCopyDialog tool={tool} copy={removing} onClose={() => setRemoving(null)} />
      {installs.length > 0 && tool.permissions && <Permissions tool={tool} />}
      {installs.length > 0 && tool.notesSetup && <MemoSetup tool={tool} />}
      {installs.length > 0 && tool.enrichment && <Enrichment tool={tool} />}
      {installs.length > 0 && tool.searchHarder && <SearchHarder tool={tool} />}
      {installs.length > 0 && tool.background && <Service tool={tool} />}
      {installs.length > 0 && tool.mailAgent && <MailAgent tool={tool} />}
      {installs.length > 0 && tool.mcpServer && <McpServer tool={tool} />}
    </div>
  )
}

// Uninstall would take every copy, so the advice removes only the ones the terminal never reaches.
// The copies come as a prop, so the notice keeps its last words while it folds away after a removal.
function ExtraCopies(props: { tool: CatalogTool; installs: Copy[]; onRemove: (copy: Copy) => void }) {
  const { tool, installs, onRemove } = props
  const [first, ...unused] = installs
  const m = useMessages(toolsMessages).details
  const button = useMessages(copiesMessages).button
  if (!first) return null
  return (
    <section
      aria-label={m.extraLabel(tool.name)}
      className="flex flex-col gap-2 rounded-[0.35rem] border border-warn/40 bg-warn/10 px-4 py-3"
    >
      <p className="flex items-start gap-2 text-[0.95rem] text-ink">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <span>
          {m.extra(
            installs.length,
            <code className="font-mono">{tool.bin}</code>,
            <code className="selectable font-mono">{first.path}</code>,
            first.version ?? m.doesNotStart,
            first.manager,
          )}
        </span>
      </p>
      <ul className="flex flex-col gap-2 pl-6">
        {unused.map((i) => (
          <li key={i.path} className="flex flex-col gap-1">
            <span className="text-[0.9rem] text-ink-soft">
              <code className="selectable font-mono">{i.path}</code> · {i.version ?? m.doesNotStart} · {i.manager}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-[22rem]">
                <CopyField value={removeCommand(i.manager, tool.package, i.path)} label={m.removeCopy(i.path)} />
              </div>
              {removable(i) && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRemove(i)}
                  icon={<Trash2 className="size-4" aria-hidden />}
                >
                  {button}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ExternalLinkButton({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        platform.openUrl(href)
      }}
      className="inline-flex items-center gap-1.5 text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
    >
      {children}
      <ExternalLink className="size-[0.95rem]" aria-hidden />
    </a>
  )
}
