import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Pill } from "@/ui/Pill"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

/** Step 4: what exists now, said plainly, and what to do next (rule 9). */
export function DoneStep() {
  const m = useMessages(addMessages)
  const added = useAddSource((s) => s.added)
  const batch = useAddSource((s) => s.batch)
  const kept = useAddSource((s) => s.kept)
  const linked = useAddSource((s) => s.linked)
  const mentions = useAddSource((s) => s.mentions)
  const { another, close } = useAddSource.getState()
  const keptFindings = (batch?.findings ?? []).filter((f) => kept.includes(f.id))
  const named = mentions?.state === "ready" ? mentions.mentions.items : []
  const about = (linked ?? []).map((ref) => named.find((n) => n.ref === ref)?.name ?? ref)

  return (
    <div className="flex flex-col gap-[1rem]">
      <p role="status" className="font-medium">
        {m.doneTitle}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-[0.6rem] text-[0.95rem]">
        <dt className="text-ink-dim">{m.source}</dt>
        <dd className="min-w-0">
          <span className="font-medium">{added?.title ?? added?.ref}</span>
          <span className="text-ink-soft"> · {added ? (m.kinds[added.kind] ?? added.kind) : null}</span>
        </dd>
        <dt className="text-ink-dim">{m.keptRow(keptFindings.length)}</dt>
        <dd className="min-w-0">
          {keptFindings.length === 0 ? (
            <span className="text-ink-soft">{m.keptNone}</span>
          ) : (
            <ul className="flex flex-col gap-[0.3rem]">
              {keptFindings.map((f) => (
                <li key={f.id} className="flex items-start gap-2">
                  <Pill>{m.findingKinds[f.kind] ?? f.kind}</Pill>
                  <span className="selectable">{f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </dd>
        {about.length > 0 && (
          <>
            <dt className="text-ink-dim">{m.about}</dt>
            <dd className="flex flex-wrap gap-2">
              {about.map((name) => (
                <Pill key={name}>{name}</Pill>
              ))}
            </dd>
          </>
        )}
      </dl>
      <p className="text-[0.9rem] text-ink-soft">{m.use}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={another}>
          {m.another}
        </Button>
        <Button variant="primary" onClick={close}>
          {m.done}
        </Button>
      </div>
    </div>
  )
}
