import { useId } from "react"
import { useMessages } from "@/i18n"
import { ChatAgentLimitSwitch } from "@/shared/ChatAgentLimitSwitch"
import { chatLimitMessages } from "@/shared/messages-chat-limit"
import { SectionTitle } from "@/ui/SectionTitle"

/** Settings, "Chat agents": whether Connect sets Hermes's and OpenClaw's profiles read only. */
export function ChatAgentSetting() {
  const m = useMessages(chatLimitMessages)
  const head = useId()
  return (
    <section id="chat-agents" aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-3">
      <SectionTitle as="h3" id={head}>
        {m.heading}
      </SectionTitle>
      <ChatAgentLimitSwitch />
    </section>
  )
}
