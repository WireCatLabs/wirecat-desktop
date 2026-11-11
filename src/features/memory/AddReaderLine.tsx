import { TriangleAlert } from "lucide-react"
import { useId } from "react"
import { chosenReader, readerOff, tooOldFor } from "@/domain/memory-add"
import { ReaderChoice } from "@/features/settings"
import { useMessages } from "@/i18n"
import type { Reader } from "@/platform/memory-add-schemas"
import { goAiModel } from "@/shared/go-ai-model"
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
      <ErrorNotice raw={error} inline>
        {m.failed}
      </ErrorNotice>
    )
  if (readers === null) return <Skeleton className="h-[1.2rem] w-[50%]" />
  const usable = readers.filter((r) => !readerOff(r))
  const waiting = readers.find((r) => r.chosen && r.id === "ai-model" && readerOff(r))
  if (!reader && waiting)
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-ink-soft">
        {m.aiModelNotReady}
        <Button size="sm" variant="ghost" onClick={goAiModel}>
          {m.goAiModel}
        </Button>
      </p>
    )
  if (!reader && usable.length > 0) return <InlineChoice readers={usable} />
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

/** "Suggest facts" did nothing until a reader was picked in Settings; the pick is made here, where it is needed. */
function InlineChoice({ readers }: { readers: Reader[] }) {
  const m = useMessages(addMessages)
  const chooseError = useReaders((s) => s.chooseError)
  const hint = useId()
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <p id={hint} className="text-[0.95rem] text-ink-soft">
        {m.noReader}
      </p>
      <ReaderChoice readers={readers} describedBy={hint} />
      <p className="flex flex-wrap items-center gap-x-3 text-[0.9rem] text-ink-dim">
        {m.otherReaders}
        <Button size="sm" variant="ghost" onClick={() => useNav.getState().go("settings")}>
          {m.goSettings}
        </Button>
      </p>
      {chooseError && (
        <ErrorNotice raw={chooseError} inline>
          {m.failed}
        </ErrorNotice>
      )}
    </div>
  )
}
