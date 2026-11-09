import { useState } from "react"
import { dropOf } from "@/domain/base-stages"
import type { Kind } from "@/domain/clients"
import { useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { type Based, useCardMove } from "./api"
import { clientMessages } from "./messages"
import { ProfilePicker } from "./ProfilePicker"
import { StagePicker } from "./StagePicker"
import { useClients } from "./store"

/**
 * Moving a card to a base stage, the same from the board and the table: refused with the reason on the card, asked
 * which stage when the base stage holds several of its pipeline, or written through memo or the CRM's CLI.
 */
export function useBaseMove(read: Based, kind: Kind) {
  const asked = useClients((st) => st.pipeline[kind] ?? null)
  const move = useCardMove(
    kind,
    asked,
    read.pipelines,
    (pipeline, stage) => read.mapping.find((x) => x.pipeline === pipeline && x.name === stage)?.externalId ?? null,
  )
  const movable = (card: CrmCard) => read.pipelines.find((p) => p.ref === card.pipeline)?.movable.kind === "yes"
  const verdict = (card: CrmCard, to: string) => dropOf(card, to, read, movable(card))
  const moveTo = (card: CrmCard, to: string) => {
    const d = verdict(card, to)
    if (d.kind === "refuse") useClients.getState().refuse(card.ref, d.why)
    if (d.kind === "move") move.run(card, d.stage)
    if (d.kind === "choose")
      useClients.getState().pick({ ref: card.ref, pipeline: card.pipeline, base: to, stages: d.stages })
  }
  return { movable, verdict, moveTo, run: move.run, chosen: move.chosen }
}

/** The dialogs a move may open, once for the page, whichever view started it. */
export function MovePickers({ read, kind, cards }: { read: Based; kind: Kind; cards: readonly CrmCard[] }) {
  const m = useMessages(clientMessages)
  const { run, chosen } = useBaseMove(read, kind)
  const [note, setNote] = useState("")
  const byRef = new Map(cards.map((c) => [c.ref, c]))
  return (
    <>
      <StagePicker
        base={read.base}
        cards={byRef}
        onMove={(ref, stage) => {
          const c = byRef.get(ref)
          if (c) run(c, stage)
        }}
        onCancel={(ref) => setNote(m.putBack(ref))}
      />
      <ProfilePicker onChoose={chosen} onCancel={(ref) => setNote(ref ? m.putBack(ref) : "")} />
      <p aria-live="polite" className="sr-only">
        {note}
      </p>
    </>
  )
}
