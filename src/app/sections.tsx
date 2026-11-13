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
import { type ComponentType, type LazyExoticComponent, lazy, type SVGProps } from "react"

// Each page is its own chunk: the first screen does not pay for the other nine.
const AgentsPage = lazy(() => import("@/features/agents/page").then((m) => ({ default: m.AgentsPage })))
const AnalyticsPage = lazy(() => import("@/features/analytics/page").then((m) => ({ default: m.AnalyticsPage })))
const ConversationPage = lazy(() =>
  import("@/features/conversation/page").then((m) => ({ default: m.ConversationPage })),
)
const ClientsPage = lazy(() => import("@/features/clients/page").then((m) => ({ default: m.ClientsPage })))
const ConfigPage = lazy(() => import("@/features/config/page").then((m) => ({ default: m.ConfigPage })))
const LinkPage = lazy(() => import("@/features/links/page").then((m) => ({ default: m.LinkPage })))
const DigestsPage = lazy(() => import("@/features/digests/page").then((m) => ({ default: m.DigestsPage })))
const MeetingsPage = lazy(() => import("@/features/meetings/page").then((m) => ({ default: m.MeetingsPage })))
const DocumentsPage = lazy(() => import("@/features/documents/page").then((m) => ({ default: m.DocumentsPage })))
const DigestSchedules = lazy(() => import("@/features/digests/page").then((m) => ({ default: m.DigestSchedules })))
const GuidesPage = lazy(() => import("@/features/guides/page").then((m) => ({ default: m.GuidesPage })))
const LogsPage = lazy(() => import("@/features/logs/page").then((m) => ({ default: m.LogsPage })))
const PeoplePage = lazy(() => import("@/features/people/page").then((m) => ({ default: m.PeoplePage })))
const MemoryPage = lazy(() => import("@/features/memory/page").then((m) => ({ default: m.MemoryPage })))
const SearchPage = lazy(() => import("@/features/search/page").then((m) => ({ default: m.SearchPage })))
const StoragePage = lazy(() => import("@/features/storage/page").then((m) => ({ default: m.StoragePage })))
const TasksPage = lazy(() => import("@/features/tasks/page").then((m) => ({ default: m.TasksPage })))
const ToolsPage = lazy(() => import("@/features/tools/page").then((m) => ({ default: m.ToolsPage })))

// The digests' schedules live on the Agents tab (owner, NEED-32 A): an agent writes them on a timer.
function AgentsTab() {
  return (
    <div className="flex flex-col gap-[1.5rem]">
      <AgentsPage />
      <DigestSchedules />
    </div>
  )
}

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
  page?: ComponentType | LazyExoticComponent<ComponentType>
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
  { id: "agents", icon: Bot, page: AgentsTab, tabOf: "tools" },
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
  // The archive of digests, opened from the Agents tab's "All digests", a digest's notification or a digest link.
  { id: "digests", icon: Newspaper, page: DigestsPage, hidden: true },
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
