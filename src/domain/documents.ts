import { setField, valuesOf } from "./query-terms"

/** What the tree needs of memo's `documents tree`. */
export type TreeSource = {
  provider: string
  source: string
  label: string
  name: string | null
  count: number
  folders: readonly { path: string; name: string; depth: number; count: number }[]
}

export type Branch = {
  id: string
  label: string
  count: number
  /** The account's provider, for its logo; absent on folders. */
  provider?: string
  children: Branch[]
}

export const ALL = "all"

const sourceId = (source: string) => `source:${source}`
const folderId = (source: string, path: string) => `folder:${source}\u0000${path}`

/**
 * memo lists folders parents first with their depth; each nests under the last folder one level up. By depth, not by
 * splitting the path: a Drive folder's own name may hold a "/".
 */
function nest(source: string, folders: TreeSource["folders"]): Branch[] {
  const top: Branch[] = []
  const open: Branch[] = []
  for (const f of folders) {
    const node: Branch = { id: folderId(source, f.path), label: f.name, count: f.count, children: [] }
    open.length = Math.max(0, f.depth - 1)
    const parent = open.at(-1)
    if (parent && open.length === f.depth - 1) parent.children.push(node)
    else top.push(node)
    open.push(node)
  }
  return top
}

/** Each account with its folders, named by its own name: its service's logo stands for the rest of memo's label. */
export const branches = (sources: readonly TreeSource[]): Branch[] =>
  sources.map((s) => ({
    id: sourceId(s.source),
    label: s.name ?? s.label,
    count: s.count,
    provider: s.provider,
    children: nest(s.source, s.folders),
  }))

/** The node the search's `source:` and `folder:` words point at; the root when they name none. */
export function nodeOfQuery(query: string): string {
  const [source] = valuesOf(query, "source")
  const [folder] = valuesOf(query, "folder")
  if (!source) return ALL
  return folder ? folderId(source, folder) : sourceId(source)
}

/** The search with the node's `source:` and `folder:` words in place of the ones it had; the root drops both. */
export function queryOfNode(query: string, id: string): string {
  const [kind, rest = ""] = id.split(/:(.*)/s) as [string, string?]
  const [source = "", folder] = kind === "folder" ? rest.split("\u0000") : [rest]
  const withSource = setField(query, "source", kind === ALL ? [] : [source])
  return setField(withSource, "folder", folder ? [folder] : [])
}

/** A document's name as shown: its title, else its file's name, else its path, else memo's ref. */
export const documentName = (d: {
  ref: string
  title: string | null
  fileName: string | null
  path: string | null
}): string => d.title ?? d.fileName ?? d.path ?? d.ref
