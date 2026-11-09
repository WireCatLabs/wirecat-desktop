import { TriangleAlert } from "lucide-react"
import { chosenReader, tooOldFor } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { useReaders } from "@/shared/readers-store"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { addMessages } from "./messages-add"

/** Who reads the text and whether it leaves this computer, said before anything is sent. */
export function ReaderLine() {
  const m = useMessages(addMessages)
  const readers = useReaders((s) => s.readers)
  const error = useReaders((s) => s.error)
  const reader = chosenReader(readers ?? [])
  if (error)
    return tooOldFor(error) ? (
      <p className="text-[0.95rem] text-ink-soft">{m.tooOldReaders}</p>
    ) : (
      <ErrorNotice inline>
        {m.failed} {error}
      </ErrorNotice>
    )
  if (readers === null) return <Skeleton className="h-[1.2rem] w-[50%]" />
  if (!reader)
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-ink-soft">
        {m.noReader}
        <Button size="sm" variant="ghost" onClick={() => useNav.getState().go("settings")}>
          {m.goSettings}
        </Button>
      </p>
    )
  return (
    <div className="text-[0.95rem]">
      <p>
        {m.reads(m.readerNames[reader.id] ?? reader.id, reader.model)} {reader.leavesComputer ? m.leaves : m.stays}
      </p>
      {reader.readsFiles && (
        <p className="mt-[0.2rem] flex items-center gap-2 text-warn-ink">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {m.readsFiles(m.readerNames[reader.id] ?? reader.id)}
        </p>
      )}
    </div>
  )
}
