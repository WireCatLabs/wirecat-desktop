import { Paperclip } from "lucide-react"
import { splitQuoted } from "@/domain/conversation"
import { formatWhen } from "@/domain/runs"
import { useLang, useMessages } from "@/i18n"
import type { ChatMessage } from "@/platform/bindings"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { LinkedText } from "./LinkedText"
import { conversationMessages } from "./messages"

// Two attachments may share a name, so each one's key counts the same names before it.
const keyed = (files: string[]) =>
  files.map((name, at) => ({ name, key: `${name}#${files.slice(0, at).filter((f) => f === name).length}` }))

function Files({ files }: { files: string[] }) {
  const m = useMessages(conversationMessages)
  if (files.length === 0) return null
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {keyed(files).map(({ name, key }) => (
        <span key={key} className="inline-flex min-w-0 items-center gap-1 text-[0.85rem] text-ink-soft">
          <Paperclip className="size-[0.85rem] shrink-0" aria-label={m.attached} />
          <span className="truncate font-mono">{name}</span>
        </span>
      ))}
    </p>
  )
}

function When({ at, now }: { at: string | null; now: Date }) {
  const lang = useLang()
  if (!at) return null
  return (
    <time dateTime={at} className="shrink-0 font-mono text-[0.8rem] text-ink-dim tabular-nums">
      {formatWhen(at, now, lang)}
    </time>
  )
}

const ROW = "border-l-2 px-[0.9rem] py-[0.45rem]"
const marked = (anchor: boolean) => (anchor ? "border-brand bg-brand-soft" : "border-transparent")

export function ChatRow({ message, now }: { message: ChatMessage; now: Date }) {
  const m = useMessages(conversationMessages)
  return (
    <li
      data-anchor={message.anchor || undefined}
      aria-current={message.anchor || undefined}
      className={cx(ROW, marked(message.anchor))}
    >
      {message.anchor && <span className="sr-only">{m.linked}</span>}
      <div className="flex items-baseline gap-3">
        <span
          className={cx("min-w-0 truncate text-[0.88rem] font-semibold", message.fromMe ? "text-brand" : "text-ink")}
        >
          {message.fromMe ? m.you : (message.sender ?? "")}
        </span>
        <When at={message.at} now={now} />
      </div>
      <p className="mt-[0.1rem] text-[0.95rem] break-words whitespace-pre-wrap text-ink">
        {message.text ? (
          <LinkedText text={message.text} />
        ) : (
          message.files.length === 0 && <span className="text-ink-dim">{m.noText}</span>
        )}
      </p>
      <Files files={message.files} />
    </li>
  )
}

export function EmailCard({ message, now }: { message: ChatMessage; now: Date }) {
  const m = useMessages(conversationMessages)
  const { own, quoted } = splitQuoted(message.text ?? "")
  const from = message.fromMe ? m.fromYou : m.from(message.sender ?? message.address ?? "")
  return (
    <li
      data-anchor={message.anchor || undefined}
      aria-current={message.anchor || undefined}
      className={cx(
        "rounded-[0.35rem] border px-[1.1rem] py-[0.9rem]",
        message.anchor ? "border-brand bg-brand-soft" : "border-line bg-app",
      )}
    >
      {message.anchor && <span className="sr-only">{m.linked}</span>}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 text-[1rem] font-semibold break-words text-ink">{message.subject ?? m.untitled}</h2>
        <When at={message.at} now={now} />
      </div>
      <p className="mt-[0.15rem] text-[0.88rem] break-words text-ink-soft">
        {from}
        {message.address && message.sender && !message.fromMe && (
          <span className="font-mono text-[0.82rem] text-ink-dim">{` <${message.address}>`}</span>
        )}
      </p>
      <p className="mt-3 text-[0.95rem] break-words whitespace-pre-wrap text-ink">
        {own ? <LinkedText text={own} /> : !quoted && <span className="text-ink-dim">{m.noText}</span>}
      </p>
      {quoted && (
        <div className="mt-3">
          <Disclosure summary={m.quoted}>
            <p className="border-l-2 border-line pl-3 text-[0.9rem] break-words whitespace-pre-wrap text-ink-soft">
              <LinkedText text={quoted} />
            </p>
          </Disclosure>
        </div>
      )}
      <Files files={message.files} />
    </li>
  )
}
