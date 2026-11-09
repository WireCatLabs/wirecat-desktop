import type { ReactNode } from "react"
import { findTool } from "@/domain/catalog"
import type { Gap } from "@/domain/needs"
import { useMessages } from "@/i18n"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { openTool, openToolAt } from "./go"
import { needsMessages } from "./messages-needs"

const nameOf = (id: string) => findTool(id)?.name ?? id

/**
 * What a page cannot work without, in the same words on every page, and the one button that leads to it on the Tools
 * page: the tool's row to install it, its update, or its accounts to sign in. `children` adds what the page itself
 * would do with it.
 */
export function ToolNeeded({ gap, inline, children }: { gap: Gap; inline?: boolean; children?: ReactNode }) {
  const m = useMessages(needsMessages)
  const install = useTools((s) => s.install)
  const tool = nameOf(gap.tool)
  const [words, label, go] =
    gap.kind === "missing"
      ? [
          `${m.missing(tool)}${gap.others.length ? ` ${m.others(gap.others.map(nameOf))}` : ""}`,
          m.install(tool),
          () => openTool(gap.tool),
        ]
      : gap.kind === "old"
        ? [
            m.old(tool, gap.version, gap.need),
            m.update(tool),
            () => {
              void install(gap.tool)
              openTool(gap.tool)
            },
          ]
        : [m.signedOut(tool), m.signIn(tool), () => openToolAt(gap.tool, "accounts")]
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-4 text-[0.95rem] text-ink-soft",
        !inline && "rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem]",
      )}
    >
      <div className="flex max-w-[70ch] flex-col gap-1">
        <p>{words}</p>
        {children}
      </div>
      <Button variant={gap.kind === "missing" ? "secondary" : "primary"} size="sm" onClick={go}>
        {label}
      </Button>
    </div>
  )
}
