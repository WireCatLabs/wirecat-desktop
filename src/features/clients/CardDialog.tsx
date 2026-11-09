import type { ReactNode } from "react"
import { crmToolOf } from "@/domain/catalog"
import { type Kind, moneyOf } from "@/domain/clients"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Select } from "@/ui/Select"
import { type Based, useBoard } from "./api"
import { useBaseMove } from "./base-move"
import { OutcomeLamp } from "./Card"
import { clientMessages } from "./messages"
import { useClients } from "./store"

/** A card's details, from the row the board already read; the whole client context waits for memo's `deals context`. */
export function CardDialog() {
  const m = useMessages(clientMessages)
  const lang = useLang()
  const kind = useClients((s) => s.kind)
  const pipeline = useClients((s) => s.pipeline[kind] ?? null)
  const open = useClients((s) => s.open)
  const { data } = useBoard(kind, pipeline)
  const card = data?.kind === "ready" || data?.kind === "base" ? data.cards.find((c) => c.ref === open) : undefined
  const close = () => useClients.getState().setOpen(null)
  const day = (iso: string | null) =>
    iso ? formatDate(`${iso.slice(0, 10)}T00:00:00`, { day: "numeric", month: "long", year: "numeric" }, lang) : null
  return (
    <Dialog
      open={card !== undefined}
      title={card?.title ?? ""}
      onClose={close}
      actions={
        <Button size="sm" onClick={close}>
          {m.close}
        </Button>
      }
    >
      {card && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-[1.2rem] gap-y-[0.55rem] text-[0.95rem]">
          <Row label={m.stage}>
            {data?.kind === "base" ? <StageField read={data} kind={kind} card={card} /> : <StageText card={card} />}
          </Row>
          <Row label={m.baseStage}>{card.baseStage?.name}</Row>
          <Row label={m.amount}>{card.amount && card.currency ? moneyOf(card.amount, card.currency, lang) : null}</Row>
          <Row label={m.organization}>{card.organization}</Row>
          <Row label={m.people}>
            {card.people.length > 0 ? (
              <ul>
                {card.people.map((p) => (
                  <li key={`${p.name}-${p.role}`}>
                    {p.name ?? m.nobody} <span className="text-ink-dim">· {m.roles[p.role] ?? p.role}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Row>
          <Row label={m.closeDate}>{day(card.closeDate)}</Row>
          <Row label={m.closedDate}>{day(card.closedDate)}</Row>
          <Row label={m.closedReason}>{card.closedReason}</Row>
          <Row label={m.project}>{card.projectName}</Row>
          <Row label={m.account}>
            {card.account
              ? `${crmToolOf(card.account.provider)?.name ?? card.account.provider} · ${card.account.account}`
              : m.ownAccount}
          </Row>
        </dl>
      )}
    </Dialog>
  )
}

function StageText({ card }: { card: CrmCard }) {
  const m = useMessages(clientMessages)
  return (
    <span className="inline-flex items-center gap-[0.5rem]">
      <OutcomeLamp outcome={card.status} />
      {card.stage} · {m.statusOf[card.status] ?? card.status}
    </span>
  )
}

/** The card's stage, changed in place among its own pipeline's stages, written the way a move on the board is. */
function StageField({ read, kind, card }: { read: Based; kind: Kind; card: CrmCard }) {
  const m = useMessages(clientMessages)
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
      options={stages.map((x) => ({ value: x.ref, label: x.name, icon: <OutcomeLamp outcome={x.outcome} /> }))}
    />
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="selectable min-w-0">{children}</dd>
    </>
  )
}
