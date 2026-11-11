import { LoaderCircle } from "lucide-react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { useJoinedFromName } from "./labels"
import { Account } from "./MatchCard"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** Says which accounts go back to whom before the join is undone. */
export function UndoMergeDialog() {
  const m = useMessages(peopleMessages)
  const joinedFrom = useJoinedFromName()
  const undoing = usePeople((s) => s.undoing)
  const detail = usePeople((s) => (s.undoing ? s.details[s.undoing.ref] : undefined))
  const busy = usePeople((s) => (s.undoing ? s.busy[s.undoing.ref] : undefined))
  const { askUndo, unmerge } = usePeople.getState()
  const person = detail?.state === "ready" ? detail.person : null
  const merge = undoing ? person?.merges.find((x) => x.id === undoing.merge) : undefined
  const back = (merge?.identities ?? []).map((ref) => person?.identities.find((i) => i.identity === ref) ?? ref)
  const from = merge ? joinedFrom(merge.from) : null
  return (
    <Dialog
      open={undoing !== null}
      title={m.undoTitle}
      onClose={() => askUndo(null)}
      actions={
        <>
          <Button onClick={() => askUndo(null)}>{m.cancel}</Button>
          <Button
            variant="danger"
            disabled={!merge || !!busy}
            icon={busy === "unmerge" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
            onClick={() => undoing && void unmerge(undoing.ref, undoing.merge)}
          >
            {m.undo}
          </Button>
        </>
      }
    >
      {merge && (
        <>
          <p className="text-[0.95rem] text-ink-soft">{from ? m.undoBody(from) : m.undoBodyUnnamed}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {back.map((i) =>
              typeof i === "string" ? (
                <li key={i} className="font-mono text-[0.9rem]">
                  {i}
                </li>
              ) : (
                <Account key={i.identity} identity={i} />
              ),
            )}
          </ul>
        </>
      )}
    </Dialog>
  )
}
