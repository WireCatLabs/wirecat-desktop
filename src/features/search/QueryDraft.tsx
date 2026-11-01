import { Sparkles } from "lucide-react"
import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { QueryDraft as Draft } from "@/platform/search-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { focusInPlace } from "@/ui/motion"
import { StableText } from "@/ui/Skeleton"
import { searchMessages } from "./messages"

type State = { kind: "idle" } | { kind: "empty" } | { kind: "writing" } | Draft

type Props = {
  tool: string | null
  /** Says what is missing on the page, as the Search button does, when no tool is chosen yet. */
  onNeedTool: () => void
  /** The query goes into the bar for the owner to check; it is never searched by itself. */
  onWritten: (query: string) => void
}

/** "Describe what you're looking for": the owner's words as the tool's query, written by an agent he set up. */
export function QueryDraft({ tool, onNeedTool, onWritten }: Props) {
  const m = useMessages(searchMessages)
  const id = useId()
  const [request, setRequest] = useState("")
  const [state, setState] = useState<State>({ kind: "idle" })
  const writing = state.kind === "writing"

  const write = async () => {
    if (writing) return
    if (!tool) return onNeedTool()
    if (!request.trim()) {
      setState({ kind: "empty" })
      focusInPlace(document.getElementById(id))
      return
    }
    setState({ kind: "writing" })
    try {
      const draft = await platform.searchDraft(tool, request.trim())
      setState(draft)
      if (draft.kind === "query") onWritten(draft.query)
    } catch (e) {
      setState({ kind: "failed", by: "claude-code", message: e instanceof Error ? e.message : String(e) })
    }
  }

  const line =
    state.kind === "empty"
      ? { text: m.draft.empty, bad: true }
      : state.kind === "writing"
        ? { text: m.draft.writing, bad: false }
        : state.kind === "query"
          ? { text: m.draft.written(m.draft.by[state.by]), bad: false }
          : state.kind === "failed"
            ? { text: m.draft.failed(m.draft.by[state.by], state.message), bad: true }
            : { text: m.draft.hint, bad: false }

  return (
    <div className="flex flex-col gap-[0.35rem]">
      <label htmlFor={id} className="text-[0.95rem] text-ink-dim">
        {m.draft.label}
      </label>
      <form
        className="flex flex-wrap items-start gap-[0.7rem]"
        onSubmit={(e) => {
          e.preventDefault()
          write()
        }}
      >
        <input
          id={id}
          value={request}
          onChange={(e) => {
            setRequest(e.target.value)
            if (state.kind === "empty") setState({ kind: "idle" })
          }}
          placeholder={m.draft.placeholder}
          autoComplete="off"
          aria-invalid={state.kind === "empty"}
          aria-describedby={`${id}-line`}
          className="h-[2.8rem] min-w-0 flex-1 basis-[26rem] rounded-[0.4rem] border border-line-strong bg-app px-[0.9rem] text-[1.02rem] text-ink placeholder:text-ink-dim focus:border-brand aria-[invalid=true]:border-bad"
        />
        <Button
          type="submit"
          size="lg"
          className="h-[2.8rem]"
          aria-busy={writing}
          icon={<Sparkles className={cx("size-4", writing && "animate-pulse")} aria-hidden />}
        >
          <StableText value={writing ? m.draft.busy : m.draft.write} variants={[m.draft.write, m.draft.busy]} />
        </Button>
      </form>
      <p
        id={`${id}-line`}
        role={line.bad ? "alert" : "status"}
        className={cx("min-h-[2.7rem] text-[0.9rem]", line.bad ? "text-bad" : "text-ink-dim")}
      >
        {line.text}
      </p>
      <Collapse open={state.kind === "query" && state.by === "codex"}>
        <p className="text-[0.9rem] text-warn-ink">{m.draft.codexWarning}</p>
      </Collapse>
      <Collapse open={state.kind === "none"}>
        <div className="rounded-[0.45rem] border border-line bg-app px-[1rem] py-[0.8rem] text-[0.92rem]">
          <p className="font-medium text-ink">{m.draft.noneTitle}</p>
          <ol className="mt-[0.4rem] flex list-decimal flex-col gap-[0.25rem] pl-[1.2rem] text-ink-soft">
            {m.draft.ways.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
          <p className="mt-[0.5rem] text-ink-dim">{m.draft.noneMeanwhile}</p>
        </div>
      </Collapse>
    </div>
  )
}
