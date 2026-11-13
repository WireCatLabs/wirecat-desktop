import type { Kind } from "@/domain/clients"
import { useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { tooOld } from "@/platform/command-error"
import { ClientCalls } from "@/shared/ClientCalls"
import { errorText } from "@/shared/errors"
import { callMessages } from "@/shared/messages-calls"
import { Button } from "@/ui/Button"
import { CopyRef } from "@/ui/CopyRef"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Select } from "@/ui/Select"
import { type Based, useBoard, useCardCalls, useStageName } from "./api"
import { useBaseMove } from "./base-move"
import { CardFacts, OutcomeLamp, StageText } from "./Card"
import { CardTasks } from "./CardTasks"
import { clientMessages } from "./messages"
import { useClients } from "./store"

/** A card's details, from the row the board already read, and its people's calls from the CRM's own CLI. */
export function CardDialog() {
  const m = useMessages(clientMessages)
  const kind = useClients((s) => s.kind)
  const pipeline = useClients((s) => s.pipeline[kind] ?? null)
  const open = useClients((s) => s.open)
  const { data } = useBoard(kind, pipeline)
  const card = data?.kind === "base" ? data.cards.find((c) => c.ref === open) : undefined
  const close = () => useClients.getState().setOpen(null)
  return (
    <Dialog
      open={card !== undefined}
      title={card?.title ?? ""}
      titleAside={<CopyRef value={card?.ref} />}
      onClose={close}
      actions={
        <Button size="sm" onClick={close}>
          {m.close}
        </Button>
      }
    >
      {card && (
        <div className="flex flex-col gap-[1.1rem]">
          <CardFacts
            card={card}
            pipeline={data?.kind === "base" ? data.pipelines.find((p) => p.ref === card.pipeline)?.name : undefined}
            stage={data?.kind === "base" ? <StageField read={data} kind={kind} card={card} /> : undefined}
          />
          <CardTasks card={card} related={data?.kind === "base" && data.relatedTasks} />
          {data?.kind === "base" && <CardCalls kind={kind} card={card} pipelines={data.pipelines} />}
        </div>
      )}
    </Dialog>
  )
}

/**
 * Calls reach a card through its people: the CRM's own CLI lists theirs. A CLI from before cli-core 0.650.0 names
 * none, and the card shows nothing, not an error.
 */
function CardCalls({ kind, card, pipelines }: { kind: Kind; card: CrmCard; pipelines: Based["pipelines"] }) {
  const m = useMessages(callMessages)
  const calls = useCardCalls(kind, card, pipelines)
  if (calls.isError && !tooOld(calls.error))
    return (
      <ErrorNotice inline raw={errorText(calls.error)}>
        {m.listFailed}
      </ErrorNotice>
    )
  return calls.data ? <ClientCalls calls={calls.data} help={m.dealHelp} /> : null
}

/** The card's stage, changed in place among its own pipeline's stages, written the way a move on the board is. */
function StageField({ read, kind, card }: { read: Based; kind: Kind; card: CrmCard }) {
  const m = useMessages(clientMessages)
  const label = useStageName(kind)
  const move = useBaseMove(read, kind)
  // The base set's own pipeline has no mapping: its stages are the base stages themselves.
  const mapped = read.mapping.filter((x) => x.pipeline === card.pipeline)
  const stages = mapped.length ? mapped : read.base
  const current = stages.find((x) => x.name === card.stage)
  if (!move.movable(card) || !current) return <StageText card={card} />
  return (
    <Select
      size="sm"
      aria-label={m.stageOf(card.title)}
      value={current.ref}
      onChange={(ref: string) => {
        const to = stages.find((x) => x.ref === ref)
        if (to && to.ref !== current.ref) move.run(card, to.name)
      }}
      options={stages.map((x) => ({
        value: x.ref,
        label: label.stage(x.name, card.account !== null),
        icon: <OutcomeLamp outcome={x.outcome} />,
      }))}
    />
  )
}
