import { Files, Folder } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { ALL, type Branch, branches, nodeOfQuery } from "@/domain/documents"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { DocumentSource } from "@/platform/bindings"
import { SourceIcon } from "@/shared/SourceIcon"
import { DatePopover } from "@/ui/Calendar"
import { cx } from "@/ui/cx"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { TreeList, type TreeNode } from "@/ui/TreeList"
import { documentMessages } from "./messages"
import { useDocuments } from "./store"

const ICON = "size-4 shrink-0 text-ink-dim"

/** The names from the account down to the node, so the chip says which "Projects" it is. */
function pathTo(nodes: readonly Branch[], id: string): string[] | null {
  for (const n of nodes) {
    if (n.id === id) return [n.label]
    const below = pathTo(n.children, id)
    if (below) return [n.label, ...below]
  }
  return null
}

const hasChildren = (nodes: readonly Branch[], id: string): boolean =>
  nodes.some((n) => (n.id === id ? n.children.length > 0 : hasChildren(n.children, id)))

/**
 * memo's accounts and their folders, behind one chip in the filter row: choosing one narrows the list, as typing its
 * `source:` and `folder:` would. The tree opens over the page, so it takes no room beside the list.
 */
export function FolderTree({ sources }: { sources: readonly DocumentSource[] | null }) {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const query = useDocuments((s) => s.query)
  const [open, setOpen] = useState(false)
  const chip = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const tree = useMemo(() => (sources ? branches(sources) : []), [sources])
  const nodes = useMemo((): TreeNode[] => {
    const node = (b: Branch): TreeNode => ({
      id: b.id,
      label: b.label,
      count: formatNumber(b.count, lang),
      // The tree already says the account's name; its logo says only the service.
      icon: b.provider ? <SourceIcon provider={b.provider} labelled /> : <Folder className={ICON} aria-hidden />,
      children: b.children.map(node),
    })
    const total = (sources ?? []).reduce((n, s) => n + s.count, 0)
    return [
      { id: ALL, label: m.all, count: formatNumber(total, lang), icon: <Files className={ICON} aria-hidden /> },
      ...tree.map(node),
    ]
  }, [sources, tree, lang, m.all])
  const selected = nodeOfQuery(query)
  const path = selected === ALL ? null : pathTo(tree, selected)
  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) chip.current?.focus()
  }
  // The tree is one tab stop; opening the chip puts focus on its chosen row, as a menu does.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus()
  }, [open])
  const on = path !== null
  return (
    <>
      <button
        ref={chip}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={cx(
          "inline-flex h-8 max-w-[20rem] min-w-0 cursor-pointer items-center gap-[0.35rem] rounded-control border pr-[0.4rem] pl-[0.6rem] text-[0.875rem] text-ink-soft transition-colors duration-(--motion-fast)",
          on
            ? "border-brand/50 bg-brand-soft hover:bg-brand/10"
            : "border-line-strong bg-app hover:bg-app-2 hover:text-ink",
        )}
      >
        <span className="shrink-0">{on ? `${m.source}:` : m.source}</span>
        {on && " "}
        {on && <span className="min-w-0 truncate font-medium text-ink">{path.join(" / ")}</span>}
        <ExpandChevron open={open} className="ml-[0.1rem]" />
      </button>
      <DatePopover open={open} anchor={chip} label={m.tree} onClose={close}>
        <div ref={panel} className="w-[18rem] max-w-[calc(100vw-2rem)]">
          <TreeList
            label={m.tree}
            nodes={nodes}
            selected={selected}
            onSelect={(id) => {
              useDocuments.getState().choose(id)
              // An account or folder with folders inside opens them instead, so the owner can go on down.
              if (!hasChildren(tree, id)) close(true)
            }}
          />
        </div>
      </DatePopover>
    </>
  )
}
