import {
  BookOpenText,
  Bot,
  Brain,
  ChartColumnBig,
  HardDrive,
  ListTodo,
  ScrollText,
  Search,
  Settings,
  Wrench,
} from "lucide-react"
import { type ComponentType, type LazyExoticComponent, lazy, type SVGProps } from "react"

// Each page is its own chunk: the first screen does not pay for the other nine.
const AgentsPage = lazy(() => import("@/features/agents/page").then((m) => ({ default: m.AgentsPage })))
const AnalyticsPage = lazy(() => import("@/features/analytics/page").then((m) => ({ default: m.AnalyticsPage })))
const ConfigPage = lazy(() => import("@/features/config/page").then((m) => ({ default: m.ConfigPage })))
const GuidesPage = lazy(() => import("@/features/guides/page").then((m) => ({ default: m.GuidesPage })))
const LogsPage = lazy(() => import("@/features/logs/page").then((m) => ({ default: m.LogsPage })))
const MemoryPage = lazy(() => import("@/features/memory/page").then((m) => ({ default: m.MemoryPage })))
const SearchPage = lazy(() => import("@/features/search/page").then((m) => ({ default: m.SearchPage })))
const StoragePage = lazy(() => import("@/features/storage/page").then((m) => ({ default: m.StoragePage })))
const TasksPage = lazy(() => import("@/features/tasks/page").then((m) => ({ default: m.TasksPage })))
const ToolsPage = lazy(() => import("@/features/tools/page").then((m) => ({ default: m.ToolsPage })))

export type Section = {
  id: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: ComponentType | LazyExoticComponent<ComponentType>
  /** `system` sections sit at the bottom of the sidebar, apart from the everyday ones. */
  group?: "system"
}

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", icon: Wrench, page: ToolsPage },
  { id: "agents", icon: Bot, page: AgentsPage },
  { id: "search", icon: Search, page: SearchPage },
  { id: "tasks", icon: ListTodo, page: TasksPage },
  { id: "guides", icon: BookOpenText, page: GuidesPage },
  { id: "memory", icon: Brain, page: MemoryPage },
  { id: "analytics", icon: ChartColumnBig, page: AnalyticsPage },
  { id: "storage", icon: HardDrive, page: StoragePage, group: "system" },
  { id: "logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "settings", icon: Settings, page: ConfigPage, group: "system" },
]
