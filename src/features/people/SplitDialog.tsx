import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { canSplit } from "@/domain/people"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Dialog } from "@/ui/Dialog"
import { useFieldError } from "@/ui/FieldError"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** Ticks the accounts that leave this person; nothing is ticked unless a doubt named them, and at least one stays. */
export function SplitDialog() {
  const m = useMessages(peopleMessages)
  const ref = usePeople((s) => s.splitting)
  const detail = usePeople((s) => (s.splitting ? s.details[s.splitting] : undefined))
  const busy = usePeople((s) => (s.splitting ? s.busy[s.splitting] : undefined))
  const { askSplit, unlink } = usePeople.getState()
  const preset = usePeople((s) => s.splitPreset)
  const [chosen, setChosen] = useState<string[]>([])
  const identities = detail?.state === "ready" ? detail.person.identities : []
  // A doubt opens the dialog with the accounts it names ticked; the owner can still change them.
  useEffect(() => setChosen(preset), [preset])
  const close = () => {
    setChosen([])
    need.clear()
    askSplit(null)
  }
  const all = chosen.length === identities.length && identities.length > 0
  const listId = useId()
  const need = useFieldError(listId, {
    live: {
      problem: canSplit(chosen, identities)
        ? null
        : all
          ? (l) => peopleMessages[l].splitAll
          : (l) => peopleMessages[l].splitPickOne,
    },
  })
  return (
    <Dialog
      open={ref !== null}
      title={m.splitTitle}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            {m.cancel}
          </Button>
          <Button
            disabled={!!busy}
            icon={busy === "unlink" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
            onClick={() =>
              canSplit(chosen, identities) ? ref && void unlink(ref, chosen).then(() => setChosen([])) : need.fail()
            }
          >
            {m.move(chosen.length)}
          </Button>
        </>
      }
    >
      <p className="text-[0.95rem] text-ink-soft">{m.splitBody}</p>
      <ul id={listId} className="mt-3 flex flex-col gap-2">
        {identities.map((i) => (
          <li key={i.identity}>
            <label className="flex cursor-pointer items-start gap-2">
              <Checkbox
                className="mt-[0.15rem]"
                disabled={!i.movable}
                checked={chosen.includes(i.identity)}
                onChange={(on) => setChosen(on ? [...chosen, i.identity] : chosen.filter((c) => c !== i.identity))}
              />
              <span>
                <span className="font-medium">{i.name ?? i.identity}</span>
                <span className="ml-2 font-mono text-[0.85rem] text-ink-dim">{i.identity}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {all && need.error === null && <p className="mt-2 text-[0.9rem] text-warn-ink">{m.splitAll}</p>}
      {need.hint}
    </Dialog>
  )
}
