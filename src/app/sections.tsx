import {
  BookOpenText,
  Bot,
  Brain,
  ChartColumnBig,
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
const GuidesPage = lazy(() => import("@/features/guides/page").then((m) => ({ default: m.GuidesPage })))
const LogsPage = lazy(() => import("@/features/logs/page").then((m) => ({ default: m.LogsPage })))
const PeoplePage = lazy(() => import("@/features/people/page").then((m) => ({ default: m.PeoplePage })))
const MemoryPage = lazy(() => import("@/features/memory/page").then((m) => ({ default: m.MemoryPage })))
const SearchPage = lazy(() => import("@/features/search/page").then((m) => ({ default: m.SearchPage })))
const StoragePage = lazy(() => import("@/features/storage/page").then((m) => ({ default: m.StoragePage })))
const TasksPage = lazy(() => import("@/features/tasks/page").then((m) => ({ default: m.TasksPage })))
const ToolsPage = lazy(() => import("@/features/tools/page").then((m) => ({ default: m.ToolsPage })))

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
}

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", icon: Wrench, page: ToolsPage },
  { id: "agents", icon: Bot, page: AgentsPage },
  { id: "search", icon: Search, page: SearchPage },
  { id: "tasks", icon: ListTodo, page: TasksPage },
  { id: "digests", icon: Newspaper, page: DigestsPage },
  { id: "clients", icon: Handshake, page: ClientsPage },
  { id: "guides", icon: BookOpenText, page: GuidesPage },
  { id: "memory", icon: Brain, page: MemoryPage },
  { id: "people", icon: Users, page: PeoplePage },
  { id: "analytics", icon: ChartColumnBig, page: AnalyticsPage },
  { id: "storage", icon: HardDrive, page: StoragePage, group: "system" },
  { id: "logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "settings", icon: Settings, page: ConfigPage, group: "system" },
  { id: "open", icon: Link2, page: LinkPage, hidden: true },
  { id: "conversation", icon: MessagesSquare, page: ConversationPage, hidden: true },
]

export const listed = (s: Section): s is Section & { id: SectionId } => !s.hidden
