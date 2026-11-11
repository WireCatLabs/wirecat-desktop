import { ChevronRight, ExternalLink, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { isConversation } from "@/domain/conversation"
import { linkTargetOf } from "@/domain/links"
import { batchSubjectOf, createdTarget, mailboxOf, tickedCount } from "@/domain/memory"
import { openConversation } from "@/features/conversation"
import { useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, PANEL_MS, reducedMotion } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { memoryMessages } from "./messages"
import { CitedRef, SourceContextView } from "./RowSources"
import { useMemory } from "./store"

/** A findings batch: each fact or task the agent proposes for the project, ticked to be created on Approve. */
export function Findings({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const skipped = useMemory((s) => s.skipped[entry.ref]) ?? []
  const busy = useMemory((s) => !!s.busy[entry.ref])
  const { skip } = useMemory.getState()
  const findings = entry.findings ?? []
  const open = entry.status === "proposed"
  // A batch may be about a person or another subject rather than a project.
  const project = batchSubjectOf(entry, m.project)
  const mailbox = mailboxOf(entry)
  const ticked = tickedCount(findings, skipped)
  const [shownRef, setShownRef] = useState<string | null>(null)
  const [gone, setGone] = useState<string[]>([])
  const opening = useMemory((s) => s.busy[entry.ref] === "open")
  const { reveal, openTask } = useMemory.getState()

  const openCreated = (id: string, created: string) => {
    if (createdTarget(created) === "task") return void openTask(entry.ref, created)
    if (!reveal(created, entry.ref)) return setGone((g) => [...g, id])
    // This batch folds shut, taking the pressed button with it: focus goes to the fact once the rows stop moving.
    setTimeout(
      () =>
        focusInPlace(
          document.querySelector<HTMLElement>(`[data-ref="${CSS.escape(created)}"] [aria-controls]`),
          "center",
        ),
      reducedMotion() ? 0 : PANEL_MS,
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">
        {mailbox !== null
          ? open
            ? m.mailHead(mailbox)
            : m.mailFor(mailbox)
          : open
            ? m.findingsHead(project)
            : m.findingsFor(project)}
      </h3>
      <ul data-findings className="flex flex-col rounded-[0.45rem] border border-line bg-app">
        {findings.map((f) => {
          const on = !skipped.includes(f.id)
          return (
            <li key={f.id} className="flex gap-[0.75rem] border-line px-[0.9rem] py-[0.75rem] not-first:border-t">
              {open ? (
                <Checkbox
                  checked={on}
                  disabled={busy}
                  aria-label={m.include(f.text)}
                  onChange={(checked) => skip(entry.ref, f.id, !checked)}
                  className="mt-[0.25rem]"
                />
              ) : (
                <span className="mt-[0.3rem]">
                  <Lamp
                    tone={f.outcome === "accepted" ? "ok" : "idle"}
                    size="sm"
                    label={m.outcomes[f.outcome ?? ""] ?? f.outcome ?? ""}
                  />
                </span>
              )}
              <span
                className={cx(
                  "min-w-0 flex-1 transition-opacity duration-(--motion-fast)",
                  open && !on && "opacity-55",
                )}
              >
                <span className="flex items-baseline gap-x-[0.5rem]">
                  <Pill tone={f.kind === "task" ? "brand" : "neutral"}>{m.findingKinds[f.kind] ?? f.kind}</Pill>
                  <span className="selectable min-w-0 text-[0.95rem] text-ink">{f.text}</span>
                </span>
                {f.reason && (
                  <span className="selectable mt-[0.15rem] block text-[0.9rem] text-ink-soft">{f.reason}</span>
                )}
                {!open && f.outcome === "accepted" && createdTarget(f.created) && (
                  <span className="mt-[0.35rem] flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={opening ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
                      onClick={() => f.created && openCreated(f.id, f.created)}
                    >
                      {createdTarget(f.created) === "task" ? m.openTask : m.openFact}
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                    {gone.includes(f.id) && <span className="text-[0.9rem] text-ink-dim">{m.createdGone}</span>}
                  </span>
                )}
                {f.evidence.length > 0 && (
                  <span className="mt-[0.3rem] flex flex-wrap items-center gap-x-[0.6rem] text-[0.85rem] text-ink-dim">
                    {!open && f.outcome && (
                      <span className="font-medium text-ink-soft">{m.outcomes[f.outcome] ?? f.outcome} ·</span>
                    )}
                    <span>{m.cites}</span>
                    {f.evidence.map((ref) => (
                      <CitedRef
                        key={ref}
                        reference={ref}
                        shown={shownRef === `${f.id} ${ref}`}
                        onToggle={() => {
                          const key = `${f.id} ${ref}`
                          if (shownRef !== key) useMemory.getState().loadContext(ref)
                          setShownRef(shownRef === key ? null : key)
                        }}
                      />
                    ))}
                    {mailbox !== null &&
                      f.evidence.map((ref) => {
                        const target = linkTargetOf(ref)
                        return target && isConversation(target) ? (
                          <Button
                            key={`open ${ref}`}
                            size="sm"
                            variant="secondary"
                            icon={<ExternalLink className="size-4" aria-hidden />}
                            onClick={() => openConversation(target)}
                          >
                            {m.openMail}
                          </Button>
                        ) : null
                      })}
                  </span>
                )}
                {f.evidence.map((ref) => (
                  <Collapse key={ref} open={shownRef === `${f.id} ${ref}`}>
                    <div className="mt-[0.5rem] overflow-hidden rounded-[0.35rem] border border-line">
                      <SourceContextView reference={ref} />
                    </div>
                  </Collapse>
                ))}
              </span>
            </li>
          )
        })}
      </ul>
      {open && (
        <p className="text-[0.9rem] text-ink-soft">
          {mailbox === null ? m.findingsNote(ticked, findings.length, project) : m.mailNote(ticked, findings.length)}
        </p>
      )}
    </div>
  )
}
