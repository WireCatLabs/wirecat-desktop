import { ArrowLeft, Lock, MessageSquareOff } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { findTool } from "@/domain/catalog"
import type { ConversationTarget } from "@/domain/conversation"
import { referenceOf, toolOfProvider } from "@/domain/links"
import { openToolAt } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { ChatHeader } from "@/platform/bindings"
import { useNav } from "@/shared/nav"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { focusInPlace } from "@/ui/motion"
import { Skeleton } from "@/ui/Skeleton"
import { MessageList } from "./MessageList"
import { conversationMessages } from "./messages"
import { type Shown, useConversation } from "./store"

const providerName = (provider: string) => findTool(toolOfProvider(provider))?.name ?? provider

/** `chat` is undefined while it is read, and null when the link did not lead to a conversation. */
function Header({ chat, target }: { chat: ChatHeader | null | undefined; target: ConversationTarget }) {
  const m = useMessages(conversationMessages)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => focusInPlace(heading.current), [])
  const canBack = useNav((s) => s.past.length > 0)
  const place = chat?.place ?? providerName(target.provider)
  const account = chat?.email ? null : (chat?.profile ?? target.account)
  return (
    <div className="flex items-start gap-3">
      {canBack && (
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowLeft className="size-4" aria-hidden />}
          onClick={() => useNav.getState().back()}
        >
          {m.back}
        </Button>
      )}
      <div className="min-w-0">
        <h1
          ref={heading}
          tabIndex={-1}
          className="step-heading font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em] break-words"
        >
          {chat === undefined ? <Skeleton chars={18} /> : chat ? (chat.title ?? m.untitled) : place}
        </h1>
        <p className="mt-1 text-[0.9rem] text-ink-soft">{[chat ? place : null, account].filter(Boolean).join(" · ")}</p>
        {chat !== null && (
          <p className="mt-1 inline-flex items-center gap-1 text-[0.82rem] text-ink-dim">
            <Lock className="size-[0.8rem]" aria-hidden />
            {m.readOnly}
          </p>
        )}
      </div>
    </div>
  )
}

function Calm(props: {
  title: string
  body?: string
  target: ConversationTarget
  action?: ReactNode
  detail?: string
}) {
  const m = useMessages(conversationMessages)
  const reference = referenceOf(props.target)
  return (
    <div className="max-w-[44rem] rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem]">
      <div className="flex items-start gap-3">
        <MessageSquareOff className="mt-[0.2rem] size-5 shrink-0 text-ink-dim" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[1.1rem] font-semibold text-ink">{props.title}</h2>
          {props.body && <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">{props.body}</p>}
          {props.detail && <p className="mt-2 font-mono text-[0.82rem] break-words text-ink-dim">{props.detail}</p>}
          <div className="mt-3 flex min-w-0 items-center gap-2">
            <span className="text-[0.85rem] text-ink-dim">{m.reference}</span>
            <code className="min-w-0 truncate rounded-[0.2rem] bg-app-2 px-2 py-[0.15rem] font-mono text-[0.85rem]">
              {reference}
            </code>
            <CopyButton value={reference} label={m.copyReference} />
          </div>
          {props.action && <div className="mt-4">{props.action}</div>}
        </div>
      </div>
    </div>
  )
}

function Body({ shown, target }: { shown: Shown; target: ConversationTarget }) {
  const m = useMessages(conversationMessages)
  const tool = toolOfProvider(target.provider)
  const tools = (
    <Button size="sm" variant="secondary" onClick={() => useNav.getState().go("tools")}>
      {m.openTools}
    </Button>
  )
  switch (shown.state) {
    case "loading":
      return <Skeleton className="h-[24rem] w-full" label={m.reading} />
    case "found":
      return (
        <MessageList
          key={referenceOf(target)}
          messages={shown.messages}
          email={target.provider === "email"}
          older={shown.older}
          newer={shown.newer}
        />
      )
    case "missing":
      if (shown.what === "account")
        return (
          <Calm
            title={m.accountTitle}
            body={m.accountBody(providerName(target.provider), target.account)}
            target={target}
            action={tools}
          />
        )
      if (shown.what === "thread") return <Calm title={m.threadTitle} body={m.threadBody} target={target} />
      return (
        <Calm
          title={target.type === "message" ? m.messageTitle : m.chatTitle}
          body={m.storedBody}
          target={target}
          action={
            findTool(tool) && (
              <Button size="sm" variant="secondary" onClick={() => openToolAt(tool, "sync")}>
                {m.openSync}
              </Button>
            )
          }
        />
      )
    case "noMemo":
      return <Calm title={m.noMemoTitle} body={m.noMemoBody} target={target} action={tools} />
    case "old":
      return <Calm title={m.oldTitle} body={m.oldBody} target={target} detail={shown.message} action={tools} />
    case "failed":
      return (
        <Calm
          title={m.failedTitle}
          detail={shown.message}
          target={target}
          action={
            <Button size="sm" variant="secondary" onClick={() => void useConversation.getState().open(target)}>
              {m.tryAgain}
            </Button>
          }
        />
      )
  }
}

/** A chat or a mail thread a link opened, read only: no reply box, nothing marked read, nothing sent. */
export function ConversationPage() {
  const target = useConversation((s) => s.target)
  const shown = useConversation((s) => s.shown)
  if (!target) return null
  const chat = shown.state === "loading" ? undefined : shown.state === "found" ? shown.chat : null
  return (
    <div className="flex flex-col gap-[1.2rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <Header key={referenceOf(target)} chat={chat} target={target} />
      <AutoHeight swap={shown.state}>
        <Body shown={shown} target={target} />
      </AutoHeight>
    </div>
  )
}
