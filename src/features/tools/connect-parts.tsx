import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { connectMessages } from "./messages-connect"

export function Para({ children }: { children: ReactNode }) {
  return <p className="max-w-[64ch] text-[0.92rem] text-ink-soft">{children}</p>
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[64ch] text-[0.9rem] text-ink-dim">{children}</p>
}

export function Progress({ state, children }: { state: "busy" | "done" | "todo" | "failed"; children: ReactNode }) {
  const tone = { busy: "busy", done: "ok", todo: "idle", failed: "bad" } as const
  const label = useMessages(connectMessages).progress[state]
  return (
    <li className="flex items-center gap-2.5">
      <Lamp tone={tone[state]} size="sm" label={label} />
      <span className={cx("text-[0.92rem]", state === "todo" ? "text-ink-dim" : "text-ink")}>{children}</span>
    </li>
  )
}
