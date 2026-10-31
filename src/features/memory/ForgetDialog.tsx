import { Trash2 } from "lucide-react"
import { can } from "@/domain/memory"
import { useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

const WORDS = 12

/** The first words of a record, so the owner sees which one goes without the whole text in a list. */
export function firstWords(text: string | null) {
  const words = (text ?? "").split(/\s+/).filter(Boolean)
  return words.length > WORDS ? `${words.slice(0, WORDS).join(" ")}…` : words.join(" ")
}

/** Lists exactly what Memo's `remove` erases (rule 5), and offers Discard, which keeps a trail, beside it. */
export function ForgetDialog({ entry }: { entry: MemoryEntry | null }) {
  const m = useMessages(memoryMessages)
  const { forget, discard, askForget } = useMemory.getState()
  const close = () => askForget(null)
  const type = entry?.type ?? "memory"
  const canDiscard = entry ? can(entry).discard : false

  return (
    <Dialog
      open={entry !== null}
      title={m.forgetTitle(type)}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" data-autofocus onClick={close}>
            {m.keep}
          </Button>
          {canDiscard && (
            <Button
              onClick={() => {
                if (!entry) return
                close()
                discard(entry.ref)
              }}
            >
              {m.discardInstead}
            </Button>
          )}
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" aria-hidden />}
            onClick={() => entry && forget(entry.ref)}
          >
            {m.forgetNow}
          </Button>
        </>
      }
    >
      {entry && (
        <div className="flex flex-col gap-3 text-[0.95rem] text-ink-soft">
          <p>{m.forgetLead}</p>
          <ul className="flex list-disc flex-col gap-1 rounded-[0.45rem] border border-line bg-app-2 py-3 pr-4 pl-8">
            <li className="text-ink">
              {m.forgetRecord(type)} <span className="font-mono text-[0.85rem]">{entry.ref}</span>:{" "}
              <span className="selectable">“{firstWords(entry.text)}”</span>
            </li>
            <li>{m.forgetLinks(entry.links)}</li>
            <li>{m.forgetIndex(type)}</li>
            <li>{m.forgetCited}</li>
          </ul>
          <p>{m.forgetStays}</p>
          <p>{m.forgetInstead}</p>
        </div>
      )}
    </Dialog>
  )
}
