import { Bot, HardDrive, RefreshCw, Terminal } from "lucide-react"
import type { ReactNode } from "react"
import { findTool, isCommunity, maker, ownerId, samePackage, tools } from "@/domain/catalog"
import { computerLine, doneRow } from "@/domain/onboarding-flow"
import { NodeNotice } from "@/features/system"
import { InstallLine, openConnect, toolsMessages, toolText } from "@/features/tools"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSystem } from "@/shared/system-store"
import { ToolIcon } from "@/shared/ToolIcon"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { StableText } from "@/ui/Skeleton"
import { onboardingMessages } from "./messages"
import { useSetupTools } from "./setup-tools"
import { rack, row } from "./step-styles"

function Fact({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className={cx(row, "items-start py-[1.1rem]")}>
      <span className="mt-[0.1rem] text-brand">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{title}</h3>
        <p className="mt-1 text-body leading-relaxed text-ink-soft">{children}</p>
      </div>
    </li>
  )
}

export function Welcome() {
  const m = useMessages(onboardingMessages).welcome
  const icon = "size-[1.5rem]"
  return (
    <>
      <ul aria-label={m.list} className={rack}>
        <Fact icon={<HardDrive className={icon} strokeWidth={1.6} aria-hidden />} title={m.localTitle}>
          {m.local}
        </Fact>
        <Fact icon={<Terminal className={icon} strokeWidth={1.6} aria-hidden />} title={m.openTitle}>
          {m.open}
        </Fact>
        <Fact icon={<Bot className={icon} strokeWidth={1.6} aria-hidden />} title={m.agentTitle}>
          {m.agent}
        </Fact>
      </ul>
      <p className="text-body text-ink-soft">{m.time}</p>
    </>
  )
}

export function Computer() {
  const r = useSystem((s) => s.readiness)
  const refreshing = useTools((s) => s.refreshing)
  const m = useMessages(onboardingMessages).computer
  const program = (
    key: "node" | "npm",
    label: string,
  ): { key: string; label: string; value: string; tone: LampTone; note: string | null } => {
    const line = computerLine(key, r?.[key])
    return {
      key,
      label,
      value: line ? (line.version ?? m.notFound) : "…",
      tone: line?.tone ?? "idle",
      note: line?.note ?? null,
    }
  }
  const items: { key: string; label: string; value: string; tone: LampTone; note?: string | null | undefined }[] = [
    { key: "system", label: m.system, value: r ? r.os : "…", tone: r ? "ok" : "idle" },
    program("node", "Node.js"),
    program("npm", "npm"),
  ]
  const ready = r?.node.ok && r.npm.ok && r.npmPrefixWritable !== false

  return (
    <>
      <ul aria-label={m.list} className={rack}>
        {items.map((i) => (
          <li key={i.key} className={row}>
            <Lamp tone={i.tone} />
            <span className="min-w-[7rem] shrink-0 font-medium">{i.label}</span>
            <span className="selectable min-w-0 flex-1 truncate font-mono text-[1.02rem] tabular-nums">{i.value}</span>
            {i.note && <span className="truncate text-[0.9rem] text-bad">{i.note}</span>}
          </li>
        ))}
      </ul>
      <NodeNotice />
      <div className="flex flex-wrap items-center gap-4">
        <p aria-live="polite" className="flex-1 text-body text-ink-soft">
          {!r ? m.checkingComputer : ready ? m.ready : null}
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={refreshing}
          onClick={() => useTools.getState().refresh(true)}
          icon={<RefreshCw className={cx("size-4", refreshing && "animate-spin")} aria-hidden />}
        >
          <StableText value={refreshing ? m.checking : m.again} variants={[m.checking, m.again]} />
        </Button>
      </div>
    </>
  )
}

export function Choose() {
  const chosen = useOnboarding((s) => s.chosen)
  const installs = useTools((s) => s.installs)
  const toggle = useOnboarding((s) => s.toggle)
  const tm = useMessages(toolsMessages)
  const m = useMessages(onboardingMessages).choose

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{m.legend}</legend>
      <ul className={cx(rack, "grid sm:grid-cols-2")}>
        {tools.map((t) => {
          const copies = installs[t.id]
          const installed = Boolean(copies?.length)
          const checked = chosen.includes(t.id)
          const cell = "flex h-full items-start gap-[0.8rem] px-[1.1rem] py-[1rem]"
          const body = (
            <>
              <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-[0.5rem]">
                  <span className="text-[1.02rem] font-semibold">{t.name}</span>
                  <span className="font-mono text-[0.9rem] text-ink-soft">{t.bin}</span>
                  {t.partOf && <Pill>{m.partOf(findTool(t.partOf)?.name ?? t.partOf)}</Pill>}
                  {isCommunity(t) && <Pill>{tm.row.community}</Pill>}
                  {installed && <Pill tone="brand">{m.installed}</Pill>}
                </span>
                <span className="mt-0.5 block text-body leading-snug text-ink-soft">{toolText(tm, t).tagline}</span>
                {isCommunity(t) && !installed && (
                  <span className="mt-0.5 block text-body leading-snug text-ink-soft">{tm.row.trust(maker(t))}</span>
                )}
              </span>
            </>
          )
          // An installed tool gets no checkbox: a ticked, greyed box would read as a choice made for the owner.
          return (
            <li key={t.id} className="-mr-px -mb-px border-line border-r border-b">
              {installed ? (
                <div className={cell}>
                  <span aria-hidden className="size-[1.05rem] shrink-0" />
                  {body}
                </div>
              ) : (
                <label className={cx(cell, checked ? "bg-brand-soft/50 hover:bg-brand-soft/70" : "hover:bg-app-2")}>
                  <Checkbox checked={checked} onChange={() => toggle(t.id)} className="mt-[0.2rem]" />
                  {body}
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

/**
 * `matrix` is the slot for the Agents feature's compact agents-by-skills matrix; until it is passed, the step says
 * how a skill gets added today.
 */
export function Agents({ matrix }: { matrix?: ReactNode }) {
  const list = useSetupTools().filter((t) => t.skill)
  const m = useMessages(onboardingMessages).agents
  if (matrix) return <>{matrix}</>
  return (
    <div className={cx(rack, "flex items-start gap-[0.9rem] px-[1.3rem] py-[1.1rem]")}>
      <Bot className="mt-[0.1rem] size-[1.5rem] shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
      <div className="flex min-w-0 flex-col gap-[0.7rem]">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{m.title}</h3>
        <p className="max-w-[65ch] text-body leading-relaxed text-ink-soft">{m.text}</p>
        {list.length > 0 && (
          <ul aria-label={m.list} className="flex flex-col gap-1">
            {list.map((t) => (
              <li key={t.id} className="flex items-baseline gap-3 text-body">
                <span className="min-w-[7.5rem] shrink-0 text-ink-soft">{t.name}</span>
                <code className="selectable font-mono text-[0.9rem] text-ink">{t.bin} skill install</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Successful installs would otherwise each leave an open "installed and runs" panel on the Tools page.
export function leave() {
  const { sessions, dismiss } = useTools.getState()
  for (const [id, s] of Object.entries(sessions))
    if (s.outcome?.event === "done") for (const t of samePackage(id)) dismiss(t.id)
}

export function Done() {
  const chosen = useOnboarding((s) => s.chosen)
  const installs = useTools((s) => s.installs)
  const sessions = useTools((s) => s.sessions)
  const list = tools.filter((t) => chosen.includes(t.id))
  const browserReady = list.find((t) => t.mcpServer && installs[t.id]?.[0]?.version)
  const m = useMessages(onboardingMessages).done
  // Rule 9: after the goal, the next things worth doing, each one leaving the setup for the page that does it.
  const go = (then: () => void) => {
    leave()
    useOnboarding.getState().finish()
    then()
  }
  return (
    <div className="flex flex-col gap-[1.5rem]">
      {list.length > 0 && (
        <ul aria-label={m.list} className={rack}>
          {list.map((t) => {
            const version = installs[t.id]?.[0]?.version
            const session = sessions[ownerId(t.id)]
            const { running, tone } = doneRow(version, session)
            return (
              <li key={t.id} className={row}>
                <Lamp tone={tone} />
                <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
                <span className="flex-1 font-semibold">{t.name}</span>
                {running ? (
                  <div className="w-[16rem] max-w-[50%]">
                    <InstallLine session={running} name={t.name} />
                  </div>
                ) : (
                  <span className={cx("font-mono text-[1.02rem] tabular-nums", version ? "text-ink" : "text-ink-soft")}>
                    {version ?? m.notInstalled}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="max-w-[65ch] text-body text-ink-soft">{m.moreLater}</p>
      <section aria-label={m.next} className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-semibold">{m.next}</h2>
        {/* Quiet on purpose: the tour at the foot leads, and these stay one click away (owner, 2026-11-05). */}
        <div className="-ml-3 flex flex-wrap gap-2">
          {browserReady && (
            <Button variant="ghost" size="sm" onClick={() => go(() => openConnect(browserReady.id))}>
              {m.connect(browserReady.name)}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => go(() => useNav.getState().go("agents"))}>
            {m.agents}
          </Button>
        </div>
      </section>
    </div>
  )
}
