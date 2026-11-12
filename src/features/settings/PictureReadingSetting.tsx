import { TriangleAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import type { Gap } from "@/domain/needs"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { PictureAgent, PictureReadingSetting as Setting } from "@/platform/ai-model-schemas"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fieldClass } from "@/ui/field"
import { SectionTitle } from "@/ui/SectionTitle"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { pictureReadingMessages } from "./messages-picture-reading"
import { usePictureReading } from "./picture-reading-store"

type Mode = Setting["mode"]
const MODES: readonly Mode[] = ["never", "request"]
const AGENTS: readonly PictureAgent[] = ["claude", "codex"]

/** Settings, "Reading pictures": whether the owner's coding agent may read a picture they choose, and which one. */
export function PictureReadingSetting() {
  const m = useMessages(pictureReadingMessages)
  const memo = useTools((s) => (s.installs.memo?.length ?? 0) > 0)
  const known = useTools((s) => s.installs.memo !== undefined)
  const gap: Gap | null = known && !memo ? { kind: "missing", tool: "memo", others: [] } : null
  const head = useId()
  if (!memo && !gap) return null
  return (
    <section id="picture-reading" aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-3">
      <div>
        <SectionTitle as="h3" id={head}>
          {m.heading}
        </SectionTitle>
        <p className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.intro}</p>
      </div>
      {memo ? <PictureReadingBody /> : gap && <ToolNeeded gap={gap} inline />}
    </section>
  )
}

function PictureReadingBody() {
  const m = useMessages(pictureReadingMessages)
  const answer = usePictureReading((s) => s.answer)
  const error = usePictureReading((s) => s.error)
  const version = useTools((s) => s.installs.memo?.[0]?.version ?? null)

  useEffect(() => {
    void usePictureReading.getState().load()
    return () => usePictureReading.setState({ actionError: null })
  }, [])

  if (error)
    return (
      <ErrorNotice raw={error} inline>
        {m.readFailed}
      </ErrorNotice>
    )
  if (answer === null) return <Skeleton className="h-[2rem] w-full max-w-[16rem]" label={m.looking} />
  if (answer.state === "old")
    return (
      <ToolNeeded gap={{ kind: "old", tool: "memo", version: answer.version ?? version, need: answer.need }} inline />
    )
  return <PictureReadingForm setting={answer.setting} />
}

function PictureReadingForm({ setting }: { setting: Setting }) {
  const m = useMessages(pictureReadingMessages)
  const lang = useLang()
  const busy = usePictureReading((s) => s.busy)
  const actionError = usePictureReading((s) => s.actionError)
  // An agent is never chosen for the owner: turning it on waits until they pick one.
  const [mode, setMode] = useState<Mode>(setting.mode)
  const [agent, setAgent] = useState<PictureAgent | null>(setting.agent)
  const [model, setModel] = useState(setting.model ?? "")
  const modelId = useId()
  const hint = useId()

  const reset = () => {
    setMode(setting.mode)
    setAgent(setting.agent)
    setModel(setting.model ?? "")
  }
  useEffect(() => {
    setMode(setting.mode)
    setAgent(setting.agent)
    setModel(setting.model ?? "")
  }, [setting])

  const choose = (next: Mode) => {
    usePictureReading.setState({ actionError: null })
    // Anyone may turn it off, and nothing is sent: it goes at once.
    if (next === "never" && setting.mode === "request") void usePictureReading.getState().set("never", null, null)
    setMode(next)
  }
  const pickAgent = (next: PictureAgent | "") => {
    if (!next) return
    // memo gives a new agent its own default, not the old agent's model.
    if (next !== agent) setModel(next === setting.agent ? (setting.model ?? "") : "")
    setAgent(next)
  }
  const changed = setting.mode !== "request" || agent !== setting.agent || model.trim() !== (setting.model ?? "")
  const said =
    actionError === "picture-reading.owner-only"
      ? m.ownerOnly
      : actionError === "picture-reading.agent-missing"
        ? m.agentMissing
        : actionError && m.setFailed
  const when = setting.since ? formatDate(setting.since, { dateStyle: "medium", timeStyle: "short" }, lang) : null

  return (
    <div className="flex max-w-[44rem] flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Segmented
          label={m.mode}
          size="md"
          value={mode}
          options={MODES.map((value) => ({ value, label: m.modes[value] }))}
          onChange={choose}
          disabled={busy}
        />
        {mode === setting.mode && (
          <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
            {setting.mode === "request" && setting.agent && when
              ? m.onSince(m.agents[setting.agent], setting.model, when)
              : m.off}
          </p>
        )}
      </div>
      <Collapse open={mode === "request"}>
        <div className="flex flex-col gap-3 rounded-[0.35rem] border border-line px-3 py-3">
          <div className="flex flex-col gap-[0.3rem]">
            <span className="text-[0.9rem] text-ink-dim">{m.agent}</span>
            <Segmented<PictureAgent | "">
              label={m.agent}
              size="md"
              value={agent ?? ""}
              options={AGENTS.map((value) => ({ value, label: m.agents[value] }))}
              onChange={pickAgent}
              disabled={busy}
            />
          </div>
          <div className="flex max-w-[22rem] flex-col gap-[0.3rem]">
            <label htmlFor={modelId} className="text-[0.9rem] text-ink-dim">
              {m.model}
            </label>
            <input
              id={modelId}
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-describedby={hint}
              disabled={busy}
              className={`${fieldClass} selectable font-mono`}
            />
            <p id={hint} className="text-[0.85rem] text-ink-soft">
              {m.modelHint}
            </p>
          </div>
          <p className="flex items-start gap-2 text-[0.9rem] text-warn-ink">
            <TriangleAlert className="mt-[0.15rem] size-4 shrink-0" aria-hidden />
            {m.warning}
          </p>
          {changed && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={busy || !agent}
                onClick={() => void usePictureReading.getState().set("request", agent, model.trim() || null)}
              >
                {setting.mode === "request" ? m.save : m.turnOn}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={reset}>
                {m.cancel}
              </Button>
            </div>
          )}
        </div>
      </Collapse>
      <Collapse open={Boolean(said)}>
        <ErrorNotice inline raw={said === m.setFailed ? actionError : null}>
          {said}
        </ErrorNotice>
      </Collapse>
    </div>
  )
}
