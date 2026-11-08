import { LoaderCircle } from "lucide-react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** Says which accounts go back to whom before the join is undone. */
export function UndoMergeDialog() {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const undoing = usePeople((s) => s.undoing)
  const detail = usePeople((s) => (s.undoing ? s.details[s.undoing.ref] : undefined))
  const busy = usePeople((s) => (s.undoing ? s.busy[s.undoing.ref] : undefined))
  const { askUndo, unmerge } = usePeople.getState()
  const merge =
    detail?.state === "ready" && undoing ? detail.person.merges.find((x) => x.id === undoing.merge) : undefined
  return (
    <Dialog
      open={undoing !== null}
      title={m.undoTitle}
      onClose={() => askUndo(null)}
      actions={
        <>
          <Button variant="ghost" onClick={() => askUndo(null)}>
            {m.cancel}
          </Button>
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
          <p className="text-[0.95rem] text-ink-soft">{m.undoBody(name(merge.from))}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {merge.identities.map((i) => (
              <li key={i} className="font-mono text-[0.9rem]">
                {i}
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  )
}
