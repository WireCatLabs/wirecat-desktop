import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Mail, MessageSquare } from "lucide-react"
import { useId, useState } from "react"
import { providerName } from "@/domain/archive"
import { placeOf } from "@/domain/conversation"
import { linkTargetOf } from "@/domain/links"
import { openConversation } from "@/features/conversation"
import { storageMessages } from "@/features/storage"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Task } from "@/platform/task-schemas"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { stamp, taskMessages } from "./messages"
import { TaskError } from "./parts"
import { useTasks } from "./store"

const SOURCE_FRESH_MS = 5 * 60_000

/**
 * The message memo found a task in: its chat, who wrote it, when, and its words, with the way to open it. memo's task
 * names the message only by reference, so the words come from the same read the conversation page makes.
 */
export function FoundSource({ task, dirty }: { task: Task; dirty: boolean }) {
  const m = useMessages(taskMessages)
  const archive = useMessages(storageMessages).archiveWords
  const lang = useLang()
  const id = useId()
  const [held, setHeld] = useState(false)
  const linked = task.source ? linkTargetOf(task.source) : null
  const target = linked?.type === "message" ? linked : null
  const read = useQuery({
    queryKey: ["tasks", "source", task.source],
    queryFn: () => (target ? platform.conversationRead(placeOf(target), { kind: "open" }) : null),
    enabled: target !== null,
    staleTime: SOURCE_FRESH_MS,
  })
  const provider = target?.provider ?? task.account?.split(":")[0] ?? ""
  const mail = provider === "email"
  const Icon = mail ? Mail : MessageSquare
  const answer = read.data
  const found = answer?.state === "found" ? answer : null
  const message = found?.messages.find((x) => x.anchor)
  const chat = found?.chat?.title ?? (provider ? providerName(provider, archive) : null)

  const open = () => {
    if (!target) return
    if (dirty) return setHeld(true)
    useTasks.getState().toggle(null)
    openConversation(target)
  }

  return (
    <section aria-labelledby={`${id}-source`} className="flex flex-col gap-[0.5rem]">
      <h3 id={`${id}-source`} className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
        <Icon className="size-[0.95rem]" aria-hidden /> {m.source}
      </h3>
      {!target ? (
        <p className="text-[0.95rem] text-ink-soft">{task.source ? m.sourceNotMessage : m.sourceUnknown}</p>
      ) : read.isPending ? (
        <div className="flex flex-col gap-[0.4rem]">
          <Skeleton className="h-[1.1rem] w-[60%]" label={m.sourceReading} />
          <Skeleton className="h-[1.1rem] w-[90%]" />
        </div>
      ) : read.isError ? (
        <TaskError reading lead={m.sourceFailed} raw={String(read.error)} />
      ) : answer?.state === "failed" ? (
        <TaskError reading lead={m.sourceFailed} raw={answer.message} />
      ) : !message ? (
        <p className="text-[0.95rem] text-ink-soft">
          {answer?.state === "missing" && answer.what === "account"
            ? m.sourceNoAccount
            : answer?.state === "noMemo" || answer?.state === "old"
              ? m.sourceOldMemo
              : m.sourceNotHere}
        </p>
      ) : (
        <article className="rounded-[0.45rem] border border-line bg-app-2 px-[0.8rem] pt-[0.5rem] pb-[0.7rem]">
          <header className="flex flex-wrap items-baseline gap-x-[0.45rem] text-[0.85rem] text-ink-dim">
            {chat && <span className="font-medium text-ink-soft">{chat}</span>}
            {message.sender && <span>{message.fromMe ? m.you : message.sender}</span>}
            {message.at && <time dateTime={message.at}>{stamp(message.at, lang)}</time>}
          </header>
          <p className="selectable mt-[0.2rem] line-clamp-4 text-[0.95rem] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
            {message.subject && !message.text ? message.subject : (message.text ?? message.files.join(", "))}
          </p>
        </article>
      )}
      {task.kind && m.nextStep[task.kind] && <p className="text-[0.9rem] text-ink-soft">{m.nextStep[task.kind]}</p>}
      {target && (
        <div className="flex flex-col items-start gap-[0.3rem]">
          <Button size="sm" onClick={open} icon={<ExternalLink className="size-4" aria-hidden />}>
            {mail ? m.openMail : m.openChat}
          </Button>
          {held && dirty && (
            <p role="alert" className="text-[0.875rem] text-ink-soft">
              {m.saveBeforeOpen}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
