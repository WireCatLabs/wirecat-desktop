// biome-ignore-all lint/a11y/useSemanticElements: an ARIA tree, whose items and groups have no HTML element
import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react"
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
}

type Row = { node: TreeNode; level: number; parent: string | null }

function visibleRows(nodes: readonly TreeNode[], open: ReadonlySet<string>, level = 1, parent: string | null = null) {
  return nodes.flatMap((node): Row[] => [
    { node, level, parent },
    ...(node.children?.length && open.has(node.id) ? visibleRows(node.children, open, level + 1, node.id) : []),
  ])
}

/** The ids from the top down to `id`'s parent, so a node chosen by typing or on return is never folded away. */
function ancestors(nodes: readonly TreeNode[], id: string | null, path: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return path
    const found = node.children ? ancestors(node.children, id, [...path, node.id]) : null
    if (found) return found
  }
  return null
}

/**
 * A tree of choices with one tab stop, as the WAI-ARIA tree pattern asks: arrows move and open, Home and End go to the
 * ends, Enter and Space choose. A node's children fold open inside it; choosing a closed node opens it too.
 */
export function TreeList({ label, nodes, selected, onSelect }: Props) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(ancestors(nodes, selected) ?? []))
  const [active, setActive] = useState<string | null>(null)
  const tree = useRef<HTMLDivElement>(null)
  const ids = useId()
  const rows = useMemo(() => visibleRows(nodes, open), [nodes, open])
  const at = useMemo(() => new Map(rows.map((r, i) => [r.node.id, i])), [rows])
  const current = [active, selected].find((id) => id !== null && at.has(id)) ?? rows[0]?.node.id ?? null

  useEffect(() => {
    const up = ancestors(nodes, selected)
    if (up?.length) setOpen((was) => (up.every((id) => was.has(id)) ? was : new Set([...was, ...up])))
  }, [nodes, selected])

  const focus = (id: string | undefined) => {
    if (!id) return
    setActive(id)
    focusInPlace(tree.current?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`) ?? null)
  }
  const toggle = (id: string, to?: boolean) => {
    const closing = !(to ?? !open.has(id))
    const item = tree.current?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)
    // Focus inside a branch that folds away would fall to the page; it goes to the branch instead.
    if (closing && item && item !== document.activeElement && item.contains(document.activeElement)) focus(id)
    setOpen((was) => {
      const next = new Set(was)
      if (closing) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const choose = (node: TreeNode) => {
    setActive(node.id)
    onSelect(node.id)
    if (node.children?.length) toggle(node.id, true)
  }

  const onKey = (e: KeyboardEvent, row: Row) => {
    // Keys reach every item the focused one sits in; only the focused one answers.
    if (e.target !== e.currentTarget) return
    const { node } = row
    const index = at.get(node.id) ?? 0
    const parent = !!node.children?.length
    switch (e.key) {
      case "ArrowDown":
        focus(rows[index + 1]?.node.id)
        break
      case "ArrowUp":
        focus(rows[index - 1]?.node.id)
        break
      case "Home":
        focus(rows[0]?.node.id)
        break
      case "End":
        focus(rows.at(-1)?.node.id)
        break
      case "ArrowRight":
        if (parent && !open.has(node.id)) toggle(node.id, true)
        else if (parent) focus(rows[index + 1]?.node.id)
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
      const kids = node.children ?? []
      const isOpen = open.has(node.id)
      const chosen = node.id === selected
      const name = `${ids}-${encodeURIComponent(node.id)}`
      return (
        <div
          key={node.id}
          role="treeitem"
          data-node={node.id}
          aria-level={level}
          aria-selected={chosen}
          aria-expanded={kids.length ? isOpen : undefined}
          aria-labelledby={node.count === undefined ? name : `${name} ${name}-n`}
          tabIndex={node.id === current ? 0 : -1}
          onKeyDown={(e) => onKey(e, { node, level, parent })}
          onFocus={(e) => e.target === e.currentTarget && setActive(node.id)}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: the treeitem around it takes the keys */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the treeitem around it takes the keys */}
          <div
            data-tree-row
            onClick={() => choose(node)}
            style={{ paddingLeft: `${0.6 + (level - 1) * 1.1}rem` }}
            className={cx(
              "flex min-h-[2.2rem] cursor-pointer items-center gap-[0.55rem] rounded-control pr-[0.5rem] text-[0.95rem]",
              "transition-colors duration-(--motion-fast) hover:bg-app-2",
              chosen ? "bg-app-2 font-medium text-ink" : "text-ink-soft",
            )}
          >
            {node.icon}
            <span id={name} className="min-w-0 flex-1 truncate">
              {node.label}
            </span>
            {node.count !== undefined && (
              <span id={`${name}-n`} className="shrink-0 font-mono text-[0.85rem] text-ink-dim tabular-nums">
                {node.count}
              </span>
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
              <div role="group" className="mt-[0.1rem] flex flex-col gap-[0.1rem]">
                {branch(kids, level + 1, node.id)}
              </div>
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
