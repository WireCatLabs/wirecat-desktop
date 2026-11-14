import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import { Collapse } from "@/ui/Collapse"
import { Switch } from "@/ui/Switch"
import { useChatAgentLimit } from "./chat-agent-limit-store"
import { chatLimitMessages } from "./messages-chat-limit"

/** The one switch for read only on chat-driven agents, the same in Settings and in the Connect dialog. */
export function ChatAgentLimitSwitch() {
  const m = useMessages(chatLimitMessages)
  const on = useChatAgentLimit((s) => s.on)
  const set = useChatAgentLimit((s) => s.set)
  const [atStart] = useState(on)
  const id = useId()
  const risk = useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Switch id={id} checked={on} onChange={set} aria-describedby={risk} />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="font-medium">
            {m.label}
          </label>
          <p id={risk} className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">
            {m.risk}
          </p>
        </div>
      </div>
      <Collapse open={on !== atStart} className="pl-[3.25rem]">
        <p role="status" className="max-w-[70ch] text-[0.9rem] text-ink-soft">
          {on ? m.onNext : m.offNow}
        </p>
      </Collapse>
    </div>
  )
}
