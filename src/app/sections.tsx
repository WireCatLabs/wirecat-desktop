import {
  BookOpenText,
  Bot,
  Brain,
  ChartColumnBig,
  FileText,
  Handshake,
  HardDrive,
  Link2,
  ListTodo,
  MessagesSquare,
  Newspaper,
  ScrollText,
  Search,
  Settings,
  Users,
  Video,
  Wrench,
} from "lucide-react"
import { type ComponentType, createElement, lazy, type SVGProps, useState } from "react"

type Loaded = { default: ComponentType }
type PageLoader = ComponentType & { preload(): void }

/**
 * A page in its own chunk, so the first screen does not pay for the others. `preload` fetches the chunk ahead (a tabbed
 * page loads its other tabs); once it is in, the page renders without suspending, so a tab switch never shows the
 * loading placeholder for a frame.
 */
function lazyPage(load: () => Promise<Loaded>): PageLoader {
  let loaded: ComponentType | null = null
  let pending: Promise<Loaded> | null = null
  const fetch = () => {
    pending ??= load().then((m) => {
      loaded = m.default
      return m
    })
    return pending
  }
  const Lazy = lazy(fetch)
  // The choice holds for the mount: switching from `Lazy` to `loaded` later would remount the page and lose its state.
  // biome-ignore lint/correctness/noComponentHookFactories: made once per page when this module loads, never in a render
  const Page = () => {
    const [Shown] = useState(() => loaded ?? Lazy)
    return createElement(Shown)
  }
  Page.preload = () => void fetch().catch(() => undefined)
  return Page
}

const AgentsPage = lazyPage(() => import("@/features/agents/page").then((m) => ({ default: m.AgentsPage })))
const AnalyticsPage = lazyPage(() => import("@/features/analytics/page").then((m) => ({ default: m.AnalyticsPage })))
const ConversationPage = lazyPage(() =>
  import("@/features/conversation/page").then((m) => ({ default: m.ConversationPage })),
)
const ClientsPage = lazyPage(() => import("@/features/clients/page").then((m) => ({ default: m.ClientsPage })))
const ConfigPage = lazyPage(() => import("@/features/config/page").then((m) => ({ default: m.ConfigPage })))
const LinkPage = lazyPage(() => import("@/features/links/page").then((m) => ({ default: m.LinkPage })))
const DigestsPage = lazyPage(() => import("@/features/digests/page").then((m) => ({ default: m.DigestsPage })))
const MeetingsPage = lazyPage(() => import("@/features/meetings/page").then((m) => ({ default: m.MeetingsPage })))
const DocumentsPage = lazyPage(() => import("@/features/documents/page").then((m) => ({ default: m.DocumentsPage })))
const GuidesPage = lazyPage(() => import("@/features/guides/page").then((m) => ({ default: m.GuidesPage })))
const LogsPage = lazyPage(() => import("@/features/logs/page").then((m) => ({ default: m.LogsPage })))
const PeoplePage = lazyPage(() => import("@/features/people/page").then((m) => ({ default: m.PeoplePage })))
const MemoryPage = lazyPage(() => import("@/features/memory/page").then((m) => ({ default: m.MemoryPage })))
const SearchPage = lazyPage(() => import("@/features/search/page").then((m) => ({ default: m.SearchPage })))
const StoragePage = lazyPage(() => import("@/features/storage/page").then((m) => ({ default: m.StoragePage })))
const TasksPage = lazyPage(() => import("@/features/tasks/page").then((m) => ({ default: m.TasksPage })))
const ToolsPage = lazyPage(() => import("@/features/tools/page").then((m) => ({ default: m.ToolsPage })))

/** The sections the sidebar lists, each with its name in `app/messages.ts`. */
export type SectionId =
  | "tools"
  | "agents"
  | "search"
  | "tasks"
  | "digests"
  | "clients"
  | "guides"
  | "memory"
  | "people"
  | "meetings"
  | "documents"
  | "analytics"
  | "storage"
  | "logs"
  | "settings"

export type Section = {
  id: SectionId | "open" | "conversation"
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: PageLoader
  /** `system` sections sit at the bottom of the sidebar, apart from the everyday ones. */
  group?: "system"
  /** Reached only from a link, never listed in the sidebar. */
  hidden?: true
  /**
   * A tab of that page, not a sidebar item: its id stays the address (`go("agents")`, a saved page, `?section=`), so
   * links to the page it used to be keep working and the tab survives a reload and back and forward.
   */
  tabOf?: SectionId
}

// The sidebar's order, top to bottom (owner, NEED-31). A new area of the app is one entry here and one folder in
// features/.
export const sections: readonly Section[] = [
  { id: "tools", icon: Wrench, page: ToolsPage },
  { id: "agents", icon: Bot, page: AgentsPage, tabOf: "tools" },
  // The digests: their presets, every digest and its schedule, and what each wrote (owner, 2026-11-14).
  { id: "digests", icon: Newspaper, page: DigestsPage, tabOf: "tools" },
  { id: "tasks", icon: ListTodo, page: TasksPage },
  { id: "clients", icon: Handshake, page: ClientsPage },
  { id: "people", icon: Users, page: PeoplePage },
  { id: "meetings", icon: Video, page: MeetingsPage },
  { id: "documents", icon: FileText, page: DocumentsPage },
  { id: "memory", icon: Brain, page: MemoryPage },
  { id: "guides", icon: BookOpenText, page: GuidesPage },
  { id: "analytics", icon: ChartColumnBig, page: AnalyticsPage },
  { id: "storage", icon: HardDrive, page: StoragePage, tabOf: "analytics" },
  { id: "search", icon: Search, page: SearchPage },
  { id: "logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "settings", icon: Settings, page: ConfigPage, group: "system" },
  { id: "open", icon: Link2, page: LinkPage, hidden: true },
  { id: "conversation", icon: MessagesSquare, page: ConversationPage, hidden: true },
]

export const listed = (s: Section): s is Section & { id: SectionId } => !s.hidden && !s.tabOf

/** The page a section is shown on: itself, or the page it is a tab of. */
export const pageOf = (id: string): string => sections.find((s) => s.id === id)?.tabOf ?? id

/** The tabs of a page, itself first, or none when it has no other. */
export const tabsOf = (id: string): (Section & { id: SectionId })[] => {
  const tabs = sections.filter((s): s is Section & { id: SectionId } => s.tabOf === id)
  const own = sections.find((s): s is Section & { id: SectionId } => s.id === id && !s.hidden)
  return tabs.length > 0 && own ? [own, ...tabs] : []
}
