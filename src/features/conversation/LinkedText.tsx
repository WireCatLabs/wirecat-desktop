import { linkParts } from "@/domain/format"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { conversationMessages } from "./messages"

/**
 * A message's text as plain text: React escapes every character, and only an https address becomes a button, which
 * the system opens in the browser on a click. Any other scheme (`javascript:`, `file:`, http) stays text.
 */
export function LinkedText({ text }: { text: string }) {
  const m = useMessages(conversationMessages)
  return (
    <>
      {linkParts(text).map((part) =>
        part.url ? (
          <button
            key={part.at}
            type="button"
            title={m.openLink(part.text)}
            onClick={() => void platform.openUrl(part.text)}
            className="rounded text-left font-medium break-all text-brand underline underline-offset-2 hover:text-brand-hover"
          >
            {part.text}
          </button>
        ) : (
          <span key={part.at}>{part.text}</span>
        ),
      )}
    </>
  )
}
