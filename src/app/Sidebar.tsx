import { ListChecks, Monitor, Moon, Sun } from "lucide-react"
import { useId } from "react"
import { HELP_OPENER, type HelpActions, HelpPanel, resumeSetup, useHelpMenu } from "@/features/onboarding"
import { useMessages } from "@/i18n"
import { BetaBadge } from "@/shared/BetaBadge"
import { useOnboarding } from "@/shared/onboarding-store"
import { cx } from "@/ui/cx"
import { Logo } from "@/ui/Logo"
import { Pill } from "@/ui/Pill"
import { Segmented } from "@/ui/Segmented"
import { useBadges } from "./badges"
import { appMessages } from "./messages"
import { type Section, sections } from "./sections"
import { type ThemeChoice, useTheme } from "./theme"

export function Sidebar(props: { active: string; onSelect: (id: string) => void; help: HelpActions }) {
  const { active, onSelect, help } = props
  const m = useMessages(appMessages)
  const themeOptions = [
    { value: "light", label: m.themeLight, icon: <Sun className="size-4" aria-hidden /> },
    { value: "system", label: m.themeSystem, icon: <Monitor className="size-4" aria-hidden /> },
    { value: "dark", label: m.themeDark, icon: <Moon className="size-4" aria-hidden /> },
  ] as const satisfies readonly { value: ThemeChoice; label: string; icon: React.ReactNode }[]
  const theme = useTheme()
  const postponed = useOnboarding((s) => s.status === "later")
  const badges = useBadges(active)
  const versionOpen = useHelpMenu((s) => s.open === "version")
  const versionMenu = useId()
  return (
    <aside
      className="reveal flex w-[12rem] shrink-0 xl:w-[13.5rem] flex-col border-line border-r bg-wall"
      data-tauri-drag-region
    >
      <div className="flex h-[7rem] shrink-0 items-center px-[1.5rem] pb-[0.6rem]" data-tauri-drag-region>
        <Logo className="flex h-[2.3rem] items-center gap-[0.75rem] [&>svg:last-child]:h-[40%]" />
      </div>
      {/* The rem grows with the window's width, so a wide, short window cannot hold every row: these scroll, the logo stays. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <nav aria-label={m.sectionsNav} className="flex flex-col gap-[0.3rem]">
          {sections
            .filter((s) => !s.group && !s.hidden)
            .map((s) => (
              <NavItem key={s.id} section={s} active={active} onSelect={onSelect} badge={Boolean(badges[s.id])} />
            ))}
        </nav>
        <nav aria-label={m.systemNav} data-tour="nav-system" className="mt-auto flex flex-col gap-[0.3rem] pb-[0.8rem]">
          {sections
            .filter((s) => s.group === "system")
            .map((s) => (
              <NavItem key={s.id} section={s} active={active} onSelect={onSelect} badge={Boolean(badges[s.id])} />
            ))}
        </nav>
      </div>
      {postponed && (
        <button
          type="button"
          onClick={() => void resumeSetup("reopen")}
          className="mx-[1rem] mb-[1rem] flex shrink-0 items-center gap-[0.7rem] rounded-[0.4rem] border border-line-strong bg-app px-[0.8rem] py-[0.6rem] text-left text-[0.95rem] text-ink hover:border-brand/50"
        >
          <ListChecks className="size-[1.1rem] shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
          {m.finishSetup}
        </button>
      )}
      <div className="flex shrink-0 items-center justify-between border-line border-t px-[1.4rem] pt-[1rem] pb-[1.6rem]">
        <div className="relative">
          <button
            type="button"
            {...{ [HELP_OPENER]: "" }}
            aria-haspopup="menu"
            aria-expanded={versionOpen}
            aria-controls={versionOpen ? versionMenu : undefined}
            aria-label={m.version(__APP_VERSION__)}
            title={m.version(__APP_VERSION__)}
            onClick={(e) => useHelpMenu.getState().toggle("version", e.currentTarget)}
            className={cx(
              "-mx-[0.4rem] rounded-[0.35rem] px-[0.4rem] py-[0.15rem] font-mono text-[0.95rem] text-ink-dim tabular-nums transition-colors duration-(--motion-fast) hover:bg-app-3 hover:text-ink",
              versionOpen && "bg-app-3 text-ink",
            )}
          >
            {__APP_VERSION__}
          </button>
          {versionOpen && <HelpPanel place="version" listId={versionMenu} {...help} />}
        </div>
        <Segmented label={m.theme} value={theme.choice} options={themeOptions} onChange={theme.set} />
      </div>
    </aside>
  )
}

function NavItem({
  section: s,
  active,
  onSelect,
  badge,
}: {
  section: Section
  active: string
  onSelect: (id: string) => void
  badge: boolean
}) {
  const m = useMessages(appMessages)
  const ready = Boolean(s.page)
  const current = s.id === active
  return (
    <button
      type="button"
      data-tour={`nav-${s.id}`}
      disabled={!ready}
      aria-current={current ? "page" : undefined}
      onClick={() => onSelect(s.id)}
      className={cx(
        "relative flex h-[2.6rem] items-center gap-[0.8rem] px-[1.5rem] text-left text-[1rem] transition-colors",
        current ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
        !ready && "cursor-default text-ink-dim/80 hover:text-ink-dim/80",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute inset-y-0 left-0 w-[4px] rounded-r-full bg-brand transition-transform duration-(--motion-normal)",
          current ? "scale-y-100" : "scale-y-0",
        )}
      />
      <s.icon
        className={cx("size-[1.2rem] shrink-0", current ? "text-brand" : "text-current")}
        strokeWidth={1.6}
        aria-hidden
      />
      <span className="flex flex-1 items-center gap-[0.5rem]">
        {m.nav[s.id]}
        <BetaBadge section={s.id} />
      </span>
      {!ready && <Pill>{m.soon}</Pill>}
      {ready && (
        <span
          aria-hidden
          className={cx(
            "size-[0.5rem] shrink-0 rounded-full bg-brand transition-[opacity,scale] duration-(--motion-slow)",
            badge ? "scale-100 opacity-100" : "scale-0 opacity-0",
          )}
        />
      )}
      {badge && <span className="sr-only">{m.badgeNew}</span>}
    </button>
  )
}
