import { Files, Folder } from "lucide-react"
import { ALL, type Branch, branches, nodeOfQuery } from "@/domain/documents"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { DocumentSource } from "@/platform/bindings"
import { SourceIcon } from "@/shared/SourceIcon"
import { Skeleton } from "@/ui/Skeleton"
import { TreeList, type TreeNode } from "@/ui/TreeList"
import { documentMessages } from "./messages"
import { useDocuments } from "./store"

const ICON = "size-4 shrink-0 text-ink-dim"

/** memo's accounts and their folders; choosing one narrows the list, as typing its `source:` and `folder:` would. */
export function FolderTree({ sources }: { sources: readonly DocumentSource[] | null }) {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const query = useDocuments((s) => s.query)
  const node = (b: Branch): TreeNode => ({
    id: b.id,
    label: b.label,
    count: formatNumber(b.count, lang),
    icon: b.provider ? (
      <SourceIcon provider={b.provider} label={b.service} labelled />
    ) : (
      <Folder className={ICON} aria-hidden />
    ),
    children: b.children.map(node),
  })
  const accounts = sources ? branches(sources) : []
  const total = (sources ?? []).reduce((n, s) => n + s.count, 0)
  const nodes: TreeNode[] = [
    {
      id: ALL,
      label: m.all,
      count: formatNumber(total, lang),
      icon: <Files className={ICON} aria-hidden />,
    },
    ...accounts.map(node),
  ]
  return (
    <nav aria-label={m.tree} className="rounded-rack border border-line-strong bg-app p-[0.4rem]">
      {sources === null ? (
        <div className="flex flex-col gap-[0.6rem] p-[0.5rem]">
          <Skeleton className="h-[1.2rem] w-[70%]" label={m.reading} />
          <Skeleton className="h-[1.2rem] w-[85%]" />
          <Skeleton className="h-[1.2rem] w-[60%]" />
        </div>
      ) : (
        <TreeList
          label={m.tree}
          nodes={nodes}
          selected={nodeOfQuery(query)}
          onSelect={(id) => useDocuments.getState().choose(id)}
        />
      )}
    </nav>
  )
}
