import type { ReactNode } from "react"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { openTool } from "./go"

/** A page that reads a tool which is missing or too old: what it needs, and the one button that gets it. */
export function ToolNeeded({
  id,
  update,
  label,
  children,
}: {
  id: string
  /** Installed but too old: the button updates it, then shows its row. */
  update: boolean
  label: string
  children: ReactNode
}) {
  const install = useTools((s) => s.install)
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem] text-[0.95rem] text-ink-soft">
      <p className="max-w-[70ch]">{children}</p>
      <Button
        variant={update ? "primary" : "secondary"}
        size="sm"
        onClick={() => {
          if (update) install(id)
          openTool(id)
        }}
      >
        {label}
      </Button>
    </div>
  )
}
