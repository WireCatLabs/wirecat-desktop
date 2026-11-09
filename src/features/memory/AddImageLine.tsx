import { useEffect } from "react"
import { hostOfOrigin } from "@/domain/ai-model"
import { imageReasonBefore } from "@/domain/memory-add"
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

const DEFAULT_HOST: Record<string, string> = { anthropic: "api.anthropic.com", openai: "api.openai.com" }

/** Under a picture's thumbnail, before Save: who will read it, where it goes, or why nobody will. */
export function ImageBefore() {
  const m = useMessages(addMessages)
  const model = useAiModel((s) => s.model)
  const error = useAiModel((s) => s.error)

  useEffect(() => {
    if (!useAiModel.getState().model) void useAiModel.getState().load()
  }, [])

  if (model === null && !error) return <Skeleton className="mt-[0.3rem] h-[1.1rem] w-[70%]" />
  const reason = imageReasonBefore(error ? null : model)
  if (reason || !model?.provider)
    return (
      <div className="mt-[0.3rem] text-[0.9rem] text-ink-soft">
        <p>{m.imageBefore[reason ?? "ai.not-set"]}</p>
        <GoAiModel className="-ml-2" />
      </div>
    )
  const host = hostOfOrigin(model.origin) || (DEFAULT_HOST[model.provider] ?? "")
  return (
    <p className="mt-[0.3rem] text-[0.9rem] text-ink-soft">
      {m.imageWillRead(`${model.provider}/${model.model ?? ""}`, host, model.provider === "ollama")}
    </p>
  )
}
