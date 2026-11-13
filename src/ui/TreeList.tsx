// biome-ignore-all lint/a11y/useSemanticElements: an ARIA tree, whose items and groups have no HTML element
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react"
import { Collapse } from "./Collapse"
import { cx } from "./cx"
import { ExpandChevron } from "./ExpandChevron"
import { focusInPlace } from "./motion"

export type TreeNode = {
  id: string
  label: string
  icon?: ReactNode
  /** Said after the label, in mono: how many things the node holds. */
  count?: string
  children?: readonly TreeNode[]
}

type Props = {
  label: string
  nodes: readonly TreeNode[]
  selected: string | null
  onSelect: (id: string) => void
  /** Open on the first render. */
  open?: readonly string[]
}

type Row = { node: TreeNode; level: number; parent: string | null }

function visibleRows(nodes: readonly TreeNode[], open: ReadonlySet<string>, level = 1, parent: string | null = null) {
  return nodes.flatMap((node): Row[] => [
    { node, level, parent },
    ...(node.children?.length && open.has(node.id) ? visibleRows(node.children, open, level + 1, node.id) : []),
  ])
}

/**
 * A tree of choices with one tab stop, as the WAI-ARIA tree pattern asks: arrows move and open, Home and End go to the
 * ends, Enter and Space choose. A node's children fold open under it; choosing a closed node opens it too.
 */
export function TreeList({ label, nodes, selected, onSelect, open: initial = [] }: Props) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initial))
  const [active, setActive] = useState<string | null>(null)
  const tree = useRef<HTMLDivElement>(null)
  const rows = visibleRows(nodes, open)
  const current = rows.find((r) => r.node.id === (active ?? selected))?.node.id ?? rows[0]?.node.id ?? null

  const toggle = (id: string, to?: boolean) =>
    setOpen((was) => {
      const next = new Set(was)
      if (to ?? !next.has(id)) next.add(id)
      else next.delete(id)
      return next
    })
  const focus = (id: string | undefined) => {
    if (!id) return
    setActive(id)
    focusInPlace(tree.current?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`) ?? null)
  }
  const choose = (node: TreeNode) => {
    setActive(node.id)
    onSelect(node.id)
    if (node.children?.length) toggle(node.id, true)
  }

  const onKey = (e: KeyboardEvent, row: Row, at: number) => {
    const { node } = row
    const parent = !!node.children?.length
    switch (e.key) {
      case "ArrowDown":
        focus(rows[at + 1]?.node.id)
        break
      case "ArrowUp":
        focus(rows[at - 1]?.node.id)
        break
      case "Home":
        focus(rows[0]?.node.id)
        break
      case "End":
        focus(rows.at(-1)?.node.id)
        break
      case "ArrowRight":
        if (parent && !open.has(node.id)) toggle(node.id, true)
        else if (parent) focus(rows[at + 1]?.node.id)
        break
      case "ArrowLeft":
        if (parent && open.has(node.id)) toggle(node.id, false)
        else if (row.parent) focus(row.parent)
        break
      case "Enter":
      case " ":
        choose(node)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const branch = (list: readonly TreeNode[], level: number, parent: string | null): ReactNode =>
    list.map((node) => {
      const at = rows.findIndex((r) => r.node.id === node.id)
      const kids = node.children ?? []
      const isOpen = open.has(node.id)
      const chosen = node.id === selected
      return (
        <div key={node.id} role="none">
          <div
            role="treeitem"
            data-node={node.id}
            aria-level={level}
            aria-selected={chosen}
            aria-expanded={kids.length ? isOpen : undefined}
            tabIndex={node.id === current ? 0 : -1}
            onClick={() => choose(node)}
            onKeyDown={(e) => onKey(e, { node, level, parent }, at)}
            onFocus={() => setActive(node.id)}
            style={{ paddingLeft: `${0.6 + (level - 1) * 1.1}rem` }}
            className={cx(
              "flex min-h-[2.2rem] cursor-pointer items-center gap-[0.55rem] rounded-control pr-[0.5rem] text-[0.95rem]",
              "transition-colors duration-(--motion-fast) hover:bg-app-2",
              chosen ? "bg-app-2 font-medium text-ink" : "text-ink-soft",
            )}
          >
            {node.icon}
            <span className="min-w-0 flex-1 truncate">{node.label}</span>
            {node.count !== undefined && (
              <span className="shrink-0 font-mono text-[0.85rem] text-ink-dim tabular-nums">{node.count}</span>
            )}
            {kids.length > 0 ? (
              // biome-ignore lint/a11y/noStaticElementInteractions: the arrows open and close it from the keyboard
              // biome-ignore lint/a11y/useKeyWithClickEvents: the arrows open and close it from the keyboard
              <span
                className="-m-[0.3rem] grid shrink-0 place-items-center rounded-control p-[0.3rem] hover:bg-app-3"
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(node.id)
                }}
              >
                <ExpandChevron open={isOpen} />
              </span>
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}
          </div>
          {kids.length > 0 && (
            <Collapse open={isOpen}>
              <div role="group">{branch(kids, level + 1, node.id)}</div>
            </Collapse>
          )}
        </div>
      )
    })

  return (
    <div ref={tree} role="tree" aria-label={label} className="flex flex-col gap-[0.1rem]">
      {branch(nodes, 1, null)}
    </div>
  )
}
