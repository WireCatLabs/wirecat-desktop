import { useId } from "react"
import { useMessages } from "@/i18n"
import { BackgroundAgentChoice } from "@/shared/BackgroundAgentChoice"
import { backgroundAgentMessages } from "@/shared/messages-background-agent"
import { SectionTitle } from "@/ui/SectionTitle"

/** Settings, "Agent for background jobs": Claude Code or Codex for the jobs that run on a timer. */
export function BackgroundAgentSetting() {
  const m = useMessages(backgroundAgentMessages)
  const head = useId()
  const help = useId()
  return (
    <section id="background-agent" aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-3">
      <div>
        <SectionTitle as="h3" id={head}>
          {m.heading}
        </SectionTitle>
        <p id={help} className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">
          {m.help}
        </p>
      </div>
      <BackgroundAgentChoice describedBy={help} />
      <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.digests}</p>
    </section>
  )
}
