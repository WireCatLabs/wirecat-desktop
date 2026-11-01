import { BookOpenText, Bot, Brain, HardDrive, ScrollText, Settings, UserRound, Wrench } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { AgentsPage } from "@/features/agents/AgentsPage"
import { ConfigPage } from "@/features/config/ConfigPage"
import { LogsPage } from "@/features/logs/LogsPage"
import { StoragePage } from "@/features/storage/StoragePage"
import { ToolsPage } from "@/features/tools/ToolsPage"
import { GuidesPage } from "../../.impeccable/mocks/guides/prototype/GuidesPage"

export type Section = {
  id: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: ComponentType
  /** `system` sections sit at the bottom of the sidebar, apart from the everyday ones. */
  group?: "system"
}

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", icon: Wrench, page: ToolsPage },
  { id: "agents", icon: Bot, page: AgentsPage },
  // Review only: the Guides prototype of docs/dev/plans/2026-11-01-guides.md.
  { id: "guides", icon: BookOpenText, page: GuidesPage },
  { id: "accounts", icon: UserRound },
  { id: "memory", icon: Brain },
  { id: "storage", icon: HardDrive, page: StoragePage, group: "system" },
  { id: "logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "settings", icon: Settings, page: ConfigPage, group: "system" },
]
