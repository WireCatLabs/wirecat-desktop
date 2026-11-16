import { Undo2 } from "lucide-react"
import { useId } from "react"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { AgentMerge, Strength } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { InfoTip } from "@/ui/InfoTip"
import { Pill } from "@/ui/Pill"
import { SectionTitle } from "@/ui/SectionTitle"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { agentMessages } from "./messages-agent"
import { usePeople } from "./store"

/** The fact a join or a match rests on, as "Phone +7 900 123-45-67". */
function factText(strength: Strength | null, names: Record<string, string>) {
  const fact = strength?.facts.find((f) => f.strong) ?? strength?.facts[0]
  return fact ? `${names[fact.kind] ?? fact.kind} ${fact.value}` : null
}

/** Why memo did not let an agent join a match by itself: the shared value and what is weak about it. */
export function NotStrong({ strength }: { strength: Strength | null | undefined }) {
  const m = useMessages(agentMessages)
  if (!strength || strength.strong) return null
  const why = m.weakNames[strength.weak ?? ""] ?? strength.weak ?? ""
  const fact = strength.weak === "nothing-shared" ? null : factText(strength, m.factNamesStrength)
  return <p className="text-[0.9rem] text-ink-soft">{m.notStrong(fact ? `${fact}, ${why}` : why)}</p>
}

/** The people agents joined on strong evidence, each with what it rested on and an Undo. */
export function AgentMerges() {
  const m = useMessages(agentMessages)
  const merges = usePeople((s) => s.agentMerges)
  const more = usePeople((s) => s.agentMergesMore)
  const head = useId()
  if (merges.length === 0) return null
  return (
    <section aria-labelledby={head} className="flex flex-col gap-[0.6rem]">
      <div>
        <SectionTitle id={head}>{m.agentMergesTitle}</SectionTitle>
        <p className="mt-1 max-w-[72ch] text-[0.95rem] text-ink-soft">{m.agentMergesIntro}</p>
      </div>
      <ul className="flex flex-col gap-[0.5rem]">
        {merges.map((merge) => (
          <AgentMergeRow key={merge.id} merge={merge} />
        ))}
      </ul>
      {more && <p className="text-[0.9rem] text-ink-dim">{m.agentMergesMore}</p>}
    </section>
  )
}

function AgentMergeRow({ merge }: { merge: AgentMerge }) {
  const m = useMessages(agentMessages)
  const p = useMessages(peopleMessages)
  const lang = useLang()
  const name = usePersonName()
  const busy = usePeople((s) => s.busy[merge.person])
  const undone = usePeople((s) => s.done[merge.person]?.op === "unmerge")
  const agent = merge.agent ?? "agent"
  const fact = factText(merge.evidence, m.factNamesStrength)
  const undo = () => {
    // The dialog lists the accounts that go back from the person's own details.
    const { need, askUndo } = usePeople.getState()
    need(merge.person)
    askUndo({ ref: merge.person, merge: merge.id })
  }
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-inset border border-line bg-app px-[1.1rem] py-[0.8rem]">
      <div className="flex min-w-0 flex-col gap-[0.3rem]">
        <p className="flex flex-wrap items-center gap-x-[0.6rem] gap-y-1">
          <span className="font-medium text-ink">{name(merge.person)}</span>
          <InfoTip label={m.agentMergedTip(agent)} trigger={<Pill tone="brand">{m.agentMergedBy(agent)}</Pill>}>
            {m.agentMergedTip(agent)}
          </InfoTip>
          {merge.at && (
            <span className="text-[0.85rem] text-ink-dim tabular-nums">
              {formatDate(merge.at, { dateStyle: "medium" }, lang)}
            </span>
          )}
        </p>
        {fact && <p className="selectable font-mono text-[0.92rem] text-ink">{fact}</p>}
        <p className="selectable font-mono text-[0.85rem] break-all text-ink-dim">{merge.identities.join(", ")}</p>
        {merge.reason && <p className="selectable text-[0.92rem]">{merge.reason}</p>}
      </div>
      <Button
        size="sm"
        disabled={undone || !!busy}
        busy={busy === "unmerge"}
        icon={<Undo2 className="size-4" aria-hidden />}
        onClick={undo}
      >
        {p.undoMerge}
      </Button>
    </li>
  )
}
