import { type ReactNode, useId, useState } from "react"
import { type CatalogTool, syncNeedsProfile, syncsHere, usesProfiles } from "@/domain/catalog"
import { termText } from "@/domain/runs"
import { useLogs } from "@/features/logs"
import { openConnect, openToolAt, useProfiles } from "@/features/tools"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { externalHref } from "@/shared/external-href"
import { useNav } from "@/shared/nav"
import { Collapse } from "@/ui/Collapse"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { LinkButton } from "@/ui/LinkButton"
import { nextMessages } from "./messages-next"

type Item = { key: string; label: string; hint?: string; open: () => void; href?: string }

function useItems(tool: CatalogTool, leave: (then: () => void) => void): Item[] {
  const m = useMessages(nextMessages)
  const { profiles } = useProfiles(tool.id)
  const signedIn = profiles?.some((p) => p.signedIn !== false) ?? false
  // A profile's sync shows only once that profile is signed in; before that, the account comes first.
  const canSync = syncsHere(tool) && (!syncNeedsProfile(tool) || signedIn)
  const items: (Item | false)[] = [
    Boolean(tool.setup) &&
      usesProfiles(tool) && {
        key: "accounts",
        label: profiles?.length ? m.addAnother : m.addAccount,
        hint: m.accountHint,
        open: () => leave(() => openToolAt(tool.id, "accounts")),
      },
    canSync && { key: "sync", label: m.sync, hint: m.syncHint, open: () => leave(() => openToolAt(tool.id, "sync")) },
    Boolean(tool.background) && {
      key: "service",
      label: m.service,
      hint: m.serviceHint,
      open: () => leave(() => openToolAt(tool.id, "service")),
    },
    Boolean(tool.skill) && {
      key: "skill",
      label: m.skill,
      hint: m.skillHint,
      open: () => leave(() => useNav.getState().go("agents")),
    },
    Boolean(tool.mcpServer) && {
      key: "mcp",
      label: m.mcp,
      hint: m.mcpHint,
      open: () => leave(() => openConnect(tool.id)),
    },
    {
      key: "logs",
      label: m.logs,
      hint: m.logsHint,
      open: () =>
        leave(() => {
          const logs = useLogs.getState()
          logs.setQuery(termText("tool", tool.id))
          logs.setRange("all")
          useNav.getState().go("logs")
        }),
    },
    { key: "docs", label: m.docs, open: () => void platform.openUrl(tool.docs), href: tool.docs },
  ]
  return items.filter((i): i is Item => i !== false)
}

/** One installed tool's next steps on the last setup step, folded so the step stays short. */
export function ToolNext(props: {
  tool: CatalogTool
  header: ReactNode
  startOpen: boolean
  leave: (then: () => void) => void
}) {
  const { tool, header, startOpen, leave } = props
  const m = useMessages(nextMessages)
  const [open, setOpen] = useState(startOpen)
  const id = useId()
  const items = useItems(tool, leave)
  return (
    <li className="flex flex-col border-line border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={m.can(tool.name)}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[3.4rem] items-center gap-[0.9rem] px-[1.3rem] py-[0.7rem] text-left hover:bg-app-2"
      >
        {header}
        <ExpandChevron open={open} />
      </button>
      <Collapse open={open} id={id}>
        <ul aria-label={m.can(tool.name)} className="grid gap-x-6 gap-y-2 px-[1.3rem] pt-1 pb-[1rem] sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key} className="min-w-0">
              <LinkButton onClick={i.open} {...(i.href && externalHref(i.href))}>
                {i.label}
              </LinkButton>
              {i.hint && <p className="text-[0.875rem] leading-snug text-ink-soft">{i.hint}</p>}
            </li>
          ))}
        </ul>
      </Collapse>
    </li>
  )
}
