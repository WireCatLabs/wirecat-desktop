import { useState } from "react"
import { choiceKey, preferred } from "@/domain/base-stages"
import { useMessages } from "@/i18n"
import type { CrmBaseStage, CrmCard } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { stageMessages } from "./messages-stages"
import { useClients } from "./store"

/** A base column holds several stages of the card's pipeline: which one, the last pick for it chosen already. */
export function StagePicker(props: {
  base: readonly CrmBaseStage[]
  cards: ReadonlyMap<string, CrmCard>
  onMove: (ref: string, stage: string) => void
  onCancel: (ref: string) => void
}) {
  const s = useMessages(stageMessages)
  const picking = useClients((st) => st.picking)
  const remembered = useClients((st) => (picking ? st.chosen[choiceKey(picking.pipeline, picking.base)] : undefined))
  const [choice, setChoice] = useState<string | null>(null)
  const card = picking ? props.cards.get(picking.ref) : undefined
  const stage =
    picking && (choice !== null && picking.stages.includes(choice) ? choice : preferred(picking.stages, remembered))
  const base = props.base.find((b) => b.ref === picking?.base)?.name ?? ""
  const close = (moved: boolean) => {
    const p = useClients.getState().picking
    useClients.getState().pick(null)
    setChoice(null)
    if (!p) return
    if (moved && stage) {
      useClients.getState().remember(choiceKey(p.pipeline, p.base), stage)
      props.onMove(p.ref, stage)
    } else props.onCancel(p.ref)
  }
  return (
    <Dialog
      open={picking !== null}
      title={s.pickTitle(base)}
      onClose={() => close(false)}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => close(false)}>
            {s.cancel}
          </Button>
          <Button size="sm" variant="primary" disabled={!stage} onClick={() => close(true)}>
            {s.move}
          </Button>
        </>
      }
    >
      {picking && (
        <fieldset className="flex flex-col gap-[0.6rem] border-0 p-0">
          <legend className="mb-[0.6rem] text-[0.95rem] text-ink-soft">{s.pickBody(card?.title ?? picking.ref)}</legend>
          {picking.stages.map((name) => (
            <label key={name} className="relative">
              <input
                type="radio"
                name="clients-stage-pick"
                checked={stage === name}
                onChange={() => setChoice(name)}
                data-autofocus={stage === name || undefined}
                className="peer sr-only"
              />
              <span
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-[0.35rem] border px-3 py-2 text-[0.95rem] transition-colors duration-(--motion-fast)",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                  stage === name
                    ? "border-brand bg-brand-soft font-medium text-ink"
                    : "border-line-strong bg-app text-ink-soft hover:border-ink-dim/60 hover:text-ink",
                )}
              >
                {name}
                {name === remembered && <span className="text-[0.85rem] text-ink-dim">{s.lastPicked}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Dialog>
  )
}
