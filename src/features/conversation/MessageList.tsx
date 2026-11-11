import { LoaderCircle } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import type { ChatMessage } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ChatRow, EmailCard } from "./MessageItem"
import { conversationMessages } from "./messages"
import { useConversation } from "./store"

const NEAR_EDGE = 120

function Edge({ side, more }: { side: "older" | "newer"; more: boolean }) {
  const m = useMessages(conversationMessages)
  const paging = useConversation((s) => s.paging)
  const busy = paging?.side === side && !paging.error
  if (paging?.side === side && paging.error)
    return (
      <div className="px-[0.9rem] py-2">
        <ErrorNotice
          inline
          raw={paging.error}
          action={
            <Button size="sm" onClick={() => void useConversation.getState().more(side)}>
              {m.tryAgain}
            </Button>
          }
        >
          {m.moreFailed}
        </ErrorNotice>
      </div>
    )
  if (!more) return side === "older" ? <p className="px-[0.9rem] py-2 text-[0.85rem] text-ink-dim">{m.start}</p> : null
  return (
    <div className="flex justify-center py-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        icon={busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        onClick={() => void useConversation.getState().more(side)}
      >
        {busy ? m.readingMore : side === "older" ? m.earlier : m.later}
      </Button>
    </div>
  )
}

/**
 * The messages oldest first in a box of their own. It opens on the linked message, centred, or on the newest one;
 * an earlier page lands above without moving what the owner is reading (rule 9), and scrolling near an edge reads the
 * next page, as the buttons there do for the keyboard.
 */
export function MessageList(props: { messages: ChatMessage[]; email: boolean; older: boolean; newer: boolean }) {
  const { messages, email, older, newer } = props
  const m = useMessages(conversationMessages)
  const [now] = useState(() => new Date())
  const box = useRef<HTMLDivElement>(null)
  const kept = useRef<{ first: string | undefined; height: number } | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const before = kept.current
    if (before === null) {
      const anchor = el.querySelector<HTMLElement>("[data-anchor]")
      el.scrollTop = anchor ? anchor.offsetTop - el.clientHeight / 2 + anchor.clientHeight / 2 : el.scrollHeight
    } else if (before.first !== messages[0]?.ref) {
      el.scrollTop += el.scrollHeight - before.height
    }
    kept.current = { first: messages[0]?.ref, height: el.scrollHeight }
  }, [messages])

  const onScroll = () => {
    const el = box.current
    if (!el) return
    const state = useConversation.getState()
    if (older && el.scrollTop < NEAR_EDGE) void state.more("older")
    else if (newer && el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_EDGE) void state.more("newer")
  }

  const Item = email ? EmailCard : ChatRow
  return (
    <div
      ref={box}
      onScroll={onScroll}
      className="selectable relative max-h-[calc(100vh-15rem)] min-h-[16rem] overflow-y-auto rounded-[0.35rem] border border-line-strong bg-app"
    >
      <Edge side="older" more={older} />
      <ol
        aria-label={email ? m.emailsLabel : m.messagesLabel}
        className={email ? "flex flex-col gap-3 px-3 pb-3" : "pb-1"}
      >
        {messages.map((message) => (
          <Item key={message.ref} message={message} now={now} />
        ))}
      </ol>
      <Edge side="newer" more={newer} />
    </div>
  )
}
