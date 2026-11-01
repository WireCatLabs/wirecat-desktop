import { useEffect, useRef, useState } from "react"
import { LABELS, type Label } from "@/domain/tasks"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Select } from "@/ui/Select"
import { taskMessages } from "./messages"
import { personName } from "./parts"
import { useTasks } from "./store"

/** The new task's row: a title and its project (memo needs both), with priority, assignee and due date if known. */
export function NewTask() {
  const m = useMessages(taskMessages)
  const projects = useTasks((s) => s.projects)
  const people = useTasks((s) => s.people)
  const busy = useTasks((s) => Boolean(s.busy.new))
  const failed = useTasks((s) => s.failed.new)
  const field = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [project, setProject] = useState(projects.length === 1 ? (projects[0]?.key ?? "") : "")
  const [priority, setPriority] = useState<Label | "none">("none")
  const [assignee, setAssignee] = useState("none")
  const [due, setDue] = useState("")

  useEffect(() => {
    field.current?.focus({ preventScroll: true })
  }, [])

  const ready = title.trim() !== "" && project !== "" && !busy
  const submit = async () => {
    if (!ready) return
    const ok = await useTasks.getState().create({
      project,
      title: title.trim(),
      ...(priority !== "none" ? { priority } : {}),
      ...(assignee !== "none" ? { assignee } : {}),
      ...(due ? { due } : {}),
    })
    if (ok) setTitle("")
  }
  const close = () => useTasks.getState().startCreate(false)

  if (projects.length === 0) {
    return <p className="border-line border-b px-[1.3rem] py-[1rem] text-[0.95rem] text-ink-soft">{m.noProjects}</p>
  }
  return (
    <form
      aria-label={m.newTask}
      className="flex flex-col gap-[0.6rem] border-line border-b bg-app-2/60 px-[1.3rem] py-[1rem]"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) close()
      }}
    >
      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <input
          ref={field}
          aria-label={m.newTitle}
          value={title}
          maxLength={500}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m.newTitleHint}
          className="selectable h-[2.4rem] min-w-[16rem] flex-1 rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] text-[0.95rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand focus-visible:outline-none"
        />
        <Select
          aria-label={m.project}
          value={project}
          placeholder={m.pickProject}
          onChange={setProject}
          options={projects.map((p) => ({ value: p.key, label: `${p.key} · ${p.name}` }))}
          className="w-[13rem]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <Select
          size="sm"
          aria-label={m.priority}
          value={priority}
          onChange={setPriority}
          options={[...LABELS, "none" as const].map((l) => ({ value: l, label: m.labels[l] }))}
          className="w-[10rem]"
        />
        <Select
          size="sm"
          aria-label={m.assignee}
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: "none", label: m.nobody },
            ...people.map((p) => ({ value: p.ref, label: personName(p.ref, people, m) })),
          ]}
          className="w-[11rem]"
        />
        <label className="flex items-center gap-[0.4rem] text-[0.875rem] text-ink-soft">
          {m.due}
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="selectable h-8 rounded-[0.35rem] border border-line-strong bg-app px-[0.4rem] font-mono text-[0.85rem] text-ink"
          />
        </label>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={close}>
            {m.cancel}
          </Button>
          <Button size="sm" type="submit" disabled={!ready}>
            {busy ? m.saving : m.add}
          </Button>
        </span>
      </div>
      {failed && <ErrorNotice inline>{m.notSaved(failed)}</ErrorNotice>}
    </form>
  )
}
