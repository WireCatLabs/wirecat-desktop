import { Globe, Mail, NotebookText, Package, Send } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import bitrix24 from "@/assets/logos/bitrix24.svg"
import calendar from "@/assets/logos/google-calendar.svg"
import drive from "@/assets/logos/google-drive.svg"
import max from "@/assets/logos/max.png"
import whatsapp from "@/assets/logos/whatsapp.svg"
import zoom from "@/assets/logos/zoom.svg"
import { cx } from "@/ui/cx"

/**
 * The services' own marks (sources in `src/assets/logos/SOURCES.md`). Their brand rules forbid recolouring, so a `text-*`
 * class does not tint them; each reads on both themes as it is.
 */
const LOGOS: Record<string, string> = {
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

/** Telegram's terms forbid its official logo in another app (API terms 2.4): a plain paper plane on a blue disc. */
function TelegramBadge({ className }: { className?: string | undefined }) {
  return (
    <span className={cx("inline-grid shrink-0 place-items-center rounded-full bg-sky-500", className)} aria-hidden>
      <Send className="size-[58%] -translate-x-[6%] translate-y-[4%] text-white" strokeWidth={2.25} />
    </span>
  )
}

/**
 * A tool's logo; WireCat's own tools, Email (one tool for every mail provider) and the Tailscale helper keep a line
 * icon. A community tool ships no icon in the app's code, so every one shows the same package.
 */
export function ToolIcon({ id, className }: { id: string; className?: string | undefined }) {
  if (id === "tg") return <TelegramBadge className={className} />
  const logo = LOGOS[id]
  if (logo) return <img src={logo} alt="" draggable={false} className={cx("object-contain", className)} />
  const Icon = icons[id] ?? Package
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}
