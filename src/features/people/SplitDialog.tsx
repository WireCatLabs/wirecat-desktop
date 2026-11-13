import { useEffect, useId, useState } from "react"
import { accountLabel, canSplit, cleanName } from "@/domain/people"
import { useMessages } from "@/i18n"
import { SourceIcon } from "@/shared/SourceIcon"
import { Button } from "@/ui/Button"
import { Checkbox, Radio } from "@/ui/Checkbox"
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
  const [namer, setNamer] = useState<string | null>(null)
  const identities = detail?.state === "ready" ? detail.person.identities : []
  // memo names the new person after the first account it is given, so a picked name goes first.
  const names = identities.flatMap((i) => {
    const name = chosen.includes(i.identity) ? cleanName(i.name) : null
    return name ? [{ identity: i.identity, name }] : []
  })
  const distinct = names.filter((n, at) => names.findIndex((o) => o.name === n.name) === at)
  const naming = distinct.find((n) => n.identity === namer) ?? distinct[0]
  const ordered = naming ? [naming.identity, ...chosen.filter((c) => c !== naming.identity)] : chosen
  // A doubt opens the dialog with the accounts it names ticked; the owner can still change them.
  useEffect(() => setChosen(preset), [preset])
  const close = () => {
    setChosen([])
    setNamer(null)
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
          <Button onClick={close}>{m.cancel}</Button>
          <Button
            disabled={!!busy}
            busy={busy === "unlink"}
            onClick={() =>
              canSplit(chosen, identities) ? ref && void unlink(ref, ordered).then(() => setChosen([])) : need.fail()
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
              <SourceIcon provider={i.provider} labelled className="mt-[0.2rem] text-ink-soft" />
              <span className="min-w-0">
                <span className="font-medium">{accountLabel(i) ?? m.noName}</span>
                <span className="ml-2 font-mono text-[0.85rem] break-all text-ink-dim">{i.identity}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {chosen.length > 0 && !all && (
        <div className="mt-3">
          {distinct.length > 1 ? (
            <fieldset>
              <legend className="text-[0.9rem] font-medium">{m.splitNameLabel}</legend>
              <p className="text-[0.85rem] text-ink-dim">{m.splitNameHelp}</p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {distinct.map((n) => (
                  <label key={n.identity} className="flex cursor-pointer items-center gap-2">
                    <Radio
                      name={`${listId}-name`}
                      checked={naming?.identity === n.identity}
                      onChange={() => setNamer(n.identity)}
                    />
                    <span>{n.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-[0.9rem] text-ink-dim">{naming ? m.splitNamed(naming.name) : m.splitName}</p>
          )}
        </div>
      )}
      {all && need.error === null && <p className="mt-2 text-[0.9rem] text-warn-ink">{m.splitAll}</p>}
      {need.hint}
    </Dialog>
  )
}
