import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { canSplit } from "@/domain/people"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Dialog } from "@/ui/Dialog"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** Ticks the accounts that leave this person; nothing is ticked for the owner, and at least one stays. */
export function SplitDialog() {
  const m = useMessages(peopleMessages)
  const ref = usePeople((s) => s.splitting)
  const detail = usePeople((s) => (s.splitting ? s.details[s.splitting] : undefined))
  const busy = usePeople((s) => (s.splitting ? s.busy[s.splitting] : undefined))
  const { askSplit, unlink } = usePeople.getState()
  const [chosen, setChosen] = useState<string[]>([])
  const identities = detail?.state === "ready" ? detail.person.identities : []
  const close = () => {
    setChosen([])
    askSplit(null)
  }
  const all = chosen.length === identities.length && identities.length > 0
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
            disabled={!canSplit(chosen, identities) || !!busy}
            icon={busy === "unlink" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
            onClick={() => ref && void unlink(ref, chosen).then(() => setChosen([]))}
          >
            {m.move(chosen.length)}
          </Button>
        </>
      }
    >
      <p className="text-[0.95rem] text-ink-soft">{m.splitBody}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {identities.map((i) => (
          <li key={i.identity}>
            <label className="flex cursor-pointer items-start gap-2">
              <Checkbox
                className="mt-[0.15rem]"
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
      {all && <p className="mt-2 text-[0.9rem] text-warn-ink">{m.splitAll}</p>}
    </Dialog>
  )
}
