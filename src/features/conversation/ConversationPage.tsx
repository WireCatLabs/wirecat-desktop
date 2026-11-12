import { ArrowLeft, Lock } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { findTool } from "@/domain/catalog"
import type { ConversationTarget } from "@/domain/conversation"
import { referenceOf, toolOfProvider } from "@/domain/links"
import type { Gap } from "@/domain/needs"
import { openToolAt } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { ChatHeader } from "@/platform/bindings"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { Disclosure } from "@/ui/Disclosure"
import { EmptyState } from "@/ui/EmptyState"
import { uiMessages } from "@/ui/messages"
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
  const account = chat?.email ? null : chat?.profiles.join(", ") || target.account
  return (
    <PageHeader
      headingRef={heading}
      back={
        canBack && (
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="size-4" aria-hidden />}
            onClick={() => useNav.getState().back()}
          >
            {m.back}
          </Button>
        )
      }
      title={chat === undefined ? <Skeleton chars={18} /> : chat ? (chat.title ?? m.untitled) : place}
      intro={
        <>
          {[chat ? place : null, account].filter(Boolean).join(" · ")}
          {chat !== null && (
            <span className="mt-1 flex items-center gap-1 text-[0.85rem] text-ink-dim">
              <Lock className="size-[0.8rem]" aria-hidden />
              {m.readOnly}
            </span>
          )}
        </>
      }
    />
  )
}

function Calm(props: {
  title: string
  body?: string
  target: ConversationTarget
  action?: ReactNode
  detail?: string
}) {
  return (
    <EmptyState title={<h2>{props.title}</h2>} action={props.action}>
      {props.body && <p>{props.body}</p>}
      {props.detail && <Detail text={props.detail} />}
      <Reference target={props.target} />
    </EmptyState>
  )
}

function Detail({ text }: { text: string }) {
  const u = useMessages(uiMessages)
  return (
    <div className="mt-2">
      <Disclosure summary={u.details}>
        <p className="selectable font-mono text-[0.85rem] break-words text-ink-dim">{text}</p>
      </Disclosure>
    </div>
  )
}

function Reference({ target }: { target: ConversationTarget }) {
  const m = useMessages(conversationMessages)
  const reference = referenceOf(target)
  return (
    <div className="mt-3 flex min-w-0 items-center gap-2">
      <span className="text-[0.85rem] text-ink-dim">{m.reference}</span>
      <code className="min-w-0 truncate rounded-rack bg-app-2 px-2 py-[0.15rem] font-mono text-[0.85rem]">
        {reference}
      </code>
      <CopyButton value={reference} label={m.copyReference} />
    </div>
  )
}

/** Memo missing or too old reads as on every other page that needs it, with the link's reference kept to copy. */
function MemoGate({ gap, target, detail }: { gap: Gap; target: ConversationTarget; detail?: string }) {
  return (
    <ToolNeeded gap={gap}>
      {detail && <Detail text={detail} />}
      <Reference target={target} />
    </ToolNeeded>
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
      return <MemoGate gap={{ kind: "missing", tool: "memo", others: [] }} target={target} />
    case "old":
      return (
        <MemoGate
          gap={{ kind: "old", tool: "memo", version: null, need: null }}
          target={target}
          detail={shown.message}
        />
      )
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
    <Page>
      <Header key={referenceOf(target)} chat={chat} target={target} />
      <AutoHeight swap={shown.state}>
        <Body shown={shown} target={target} />
      </AutoHeight>
    </Page>
  )
}
