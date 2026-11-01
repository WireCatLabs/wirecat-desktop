import { Bot, MessageSquare, User } from "lucide-react"
import { useId, useState } from "react"
import { useLang, useMessages } from "@/i18n"
import type { TaskComment } from "@/platform/task-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { stamp, taskMessages } from "./messages"
import { useTasks } from "./store"

function Author({ comment }: { comment: TaskComment }) {
  const m = useMessages(taskMessages)
  const a = comment.author
  const agent = Boolean(a && !a.owner && a.type !== "person")
  const Icon = agent ? Bot : User
  return (
    <>
      <Icon role="img" aria-label={agent ? m.byAgent : m.byPerson} className="size-[0.85rem] shrink-0" />
      <span className="font-medium text-ink-soft">{a?.owner ? m.you : (a?.name ?? m.someone)}</span>
    </>
  )
}

/** What people and agents wrote on the task, oldest first, and a box to add the owner's own. */
export function Comments({ taskKey }: { taskKey: string }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const id = useId()
  const comments = useTasks((s) => s.comments[taskKey])
  const busy = useTasks((s) => Boolean(s.busy[`comment:${taskKey}`]))
  const failed = useTasks((s) => s.failed[`comment:${taskKey}`])
  const [text, setText] = useState("")
  const ready = text.trim() !== ""
  const send = async () => {
    if (!ready || busy) return
    if (await useTasks.getState().comment(taskKey, text)) setText("")
  }

  return (
    <section aria-labelledby={`${id}-head`} className="flex flex-col gap-[0.5rem]">
      <h3 id={`${id}-head`} className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
        <MessageSquare className="size-[0.95rem]" aria-hidden /> {m.comments}
      </h3>
      {!comments || comments.state === "loading" ? (
        <Skeleton className="h-[3.2rem] w-full rounded-[0.45rem]" label={m.comments} />
      ) : comments.state === "failed" ? (
        <p className="text-[0.9rem] text-bad">{m.commentsFailed}</p>
      ) : comments.items.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.commentsEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-[0.5rem]">
          {comments.items.map((c) => (
            <li
              key={c.ref ?? `${c.at}|${c.text}`}
              className="reveal rounded-[0.45rem] border border-line bg-app-2 px-[0.8rem] pt-[0.45rem] pb-[0.6rem]"
            >
              <header className="flex items-center gap-[0.45rem] text-[0.85rem] text-ink-dim">
                <Author comment={c} />
                <time dateTime={c.at} className="tabular-nums">
                  {stamp(c.at, lang)}
                </time>
              </header>
              <p className="selectable mt-[0.2rem] text-[0.95rem] whitespace-pre-wrap text-ink">{c.text}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        className="flex flex-col gap-[0.4rem]"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          aria-label={m.addComment}
          rows={2}
          value={text}
          maxLength={20_000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder={`${m.addComment}. ${m.commentHint}`}
          className="selectable rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand"
        />
        {/* The button appears with the first word; its line is kept, so nothing below moves. */}
        <div
          inert={(!ready && !busy) || undefined}
          aria-hidden={(!ready && !busy) || undefined}
          className={cx(
            "flex gap-2 transition-opacity duration-150",
            !ready && !busy && "pointer-events-none opacity-0",
          )}
        >
          <Button variant="primary" size="sm" type="submit" disabled={busy}>
            {busy ? m.sending : m.send}
          </Button>
        </div>
        {failed && <ErrorNotice inline>{m.commentFailed(failed)}</ErrorNotice>}
      </form>
    </section>
  )
}
