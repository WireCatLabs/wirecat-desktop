import {
  Building2,
  CalendarDays,
  Globe,
  Mail,
  MessageCircle,
  MessagesSquare,
  NotebookText,
  Package,
  Send,
  Video,
} from "lucide-react"
import type { ComponentType, SVGProps } from "react"

function DriveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8.5 3.5h7l6 10.5-3.5 6h-12L2.5 14z" />
      <path d="M8.5 3.5 14 14H2.5M15.5 3.5 9.5 14l-3.5 6M14 14l4 6" />
    </svg>
  )
}

const icons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  tg: Send,
  max: MessagesSquare,
  wa: MessageCircle,
  zm: Video,
  drive: DriveIcon,
  gcal: CalendarDays,
  memo: NotebookText,
  email: Mail,
  bitrix: Building2,
  funnel: Globe,
}

/** A community tool ships no icon in the app's code, so every one shows the same package. */
export function ToolIcon({ id, className }: { id: string; className?: string }) {
  const Icon = icons[id] ?? Package
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}
