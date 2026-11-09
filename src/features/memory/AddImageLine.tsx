import { useEffect } from "react"
import { hostOfOrigin, providerHost, staysHere } from "@/domain/ai-model"
import { imageReasonBefore, tooOldFor } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import { useAiModel } from "@/shared/ai-model-store"
import { useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { addMessages } from "./messages-add"

/** The way to Settings, where the AI model is chosen; the section sits at the top of the page. */
export function GoAiModel({ className }: { className?: string }) {
  const m = useMessages(addMessages)
  return (
    <Button size="sm" variant="ghost" className={className} onClick={() => useNav.getState().go("settings")}>
      {m.goAiModel}
    </Button>
  )
}

/** Under a picture's thumbnail, before Save: who will read it, where it goes, or why nobody will. */
export function ImageBefore() {
  const m = useMessages(addMessages)
  const model = useAiModel((s) => s.model)
  const error = useAiModel((s) => s.error)

  useEffect(() => {
    void useAiModel.getState().load()
  }, [])

  if (model === null && !error) return <Skeleton className="mt-[0.3rem] h-[1.1rem] w-[70%]" />
  if (error && tooOldFor(error)) return <p className="mt-[0.3rem] text-[0.9rem] text-ink-soft">{m.imageNeedsUpdate}</p>
  if (error)
    return (
      <div className="mt-[0.3rem] text-[0.9rem] text-ink-soft">
        <p>{m.imageUnknown}</p>
        <GoAiModel className="-ml-2" />
      </div>
    )
  const reason = imageReasonBefore(model)
  if (reason || !model?.provider)
    return (
      <div className="mt-[0.3rem] text-[0.9rem] text-ink-soft">
        <p>{m.imageBefore[reason ?? "ai.not-set"]}</p>
        <GoAiModel className="-ml-2" />
      </div>
    )
  const host = hostOfOrigin(model.origin) || providerHost(model.provider, model.baseUrl)
  return (
    <p className="mt-[0.3rem] text-[0.9rem] text-ink-soft">
      {m.imageWillRead(
        `${model.provider}/${model.model ?? ""}`,
        host,
        staysHere(model.provider, model.origin ?? model.baseUrl),
      )}
    </p>
  )
}
