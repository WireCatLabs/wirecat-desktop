import { Bot, Brain, HardDrive, ListTodo, ScrollText, Search, Settings, Wrench } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { AgentsPage } from "@/features/agents/AgentsPage"
import { ConfigPage } from "@/features/config/ConfigPage"
import { LogsPage } from "@/features/logs/LogsPage"
import { MemoryPage } from "@/features/memory/MemoryPage"
import { SearchPage } from "@/features/search/SearchPage"
import { StoragePage } from "@/features/storage/StoragePage"
import { TasksPage } from "@/features/tasks/TasksPage"
import { ToolsPage } from "@/features/tools/ToolsPage"
import { AddToMemoryPrototype } from "../../.impeccable/mocks/memory/add/prototype/AddToMemory"

export type Section = {
  id: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: ComponentType
  /** `system` sections sit at the bottom of the sidebar, apart from the everyday ones. */
  group?: "system"
}

// Review branch only: PR #40's "Add to memory" prototype replaces the Memory page under `?add=<state>`.
const addPrototype = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add")

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", icon: Wrench, page: ToolsPage },
  { id: "agents", icon: Bot, page: AgentsPage },
  { id: "search", icon: Search, page: SearchPage },
  { id: "tasks", icon: ListTodo, page: TasksPage },
  { id: "memory", icon: Brain, page: addPrototype ? AddToMemoryPrototype : MemoryPage },
  { id: "storage", icon: HardDrive, page: StoragePage, group: "system" },
  { id: "logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "settings", icon: Settings, page: ConfigPage, group: "system" },
]
