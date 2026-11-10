import { Globe, Mail, NotebookText, Package } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import bitrix24 from "@/assets/logos/bitrix24.svg"
import calendar from "@/assets/logos/google-calendar.svg"
import drive from "@/assets/logos/google-drive.svg"
import max from "@/assets/logos/max.png"
import telegram from "@/assets/logos/telegram.svg"
import whatsapp from "@/assets/logos/whatsapp.svg"
import zoom from "@/assets/logos/zoom.png"
import { cx } from "@/ui/cx"

/**
 * The services' own marks (sources in `src/assets/logos/SOURCES.md`). Their brand rules forbid recolouring, so a `text-*`
 * class does not tint them; each reads on both themes as it is.
 */
const LOGOS: Record<string, string> = {
  tg: telegram,
  max,
  wa: whatsapp,
  zm: zoom,
  drive,
  gcal: calendar,
  bitrix: bitrix24,
}

const icons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  memo: NotebookText,
  email: Mail,
  funnel: Globe,
}

/**
 * A tool's logo; WireCat's own tools, Email (one tool for every mail provider) and the Tailscale helper keep a line
 * icon. A community tool ships no icon in the app's code, so every one shows the same package.
 */
export function ToolIcon({ id, className }: { id: string; className?: string | undefined }) {
  const logo = LOGOS[id]
  if (logo) return <img src={logo} alt="" draggable={false} className={cx("object-contain", className)} />
  const Icon = icons[id] ?? Package
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}
