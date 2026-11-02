import { useEffect, useRef, useState } from "react"
import { LABELS, type Label } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { DateField } from "@/ui/Calendar"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Select } from "@/ui/Select"
import { dueDay, taskMessages } from "./messages"
import { personName } from "./parts"
import { useTasks } from "./store"

/** The new task's row: a title and its project (memo needs both), with priority, assignee and due date if known. */
export function NewTask() {
  const m = useMessages(taskMessages)
  const lang = useLang()
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
  const [missing, setMissing] = useState<"title" | "project" | null>(null)
  const projectBox = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    field.current?.focus({ preventScroll: true })
  }, [])

  const submit = async () => {
    if (busy) return
    // Pressed too early, the button says what is missing and takes the owner there (DESIGN.md).
    if (!title.trim()) {
      setMissing("title")
      field.current?.focus()
      return
    }
    if (!project) {
      setMissing("project")
      projectBox.current?.querySelector<HTMLElement>("button,[role=combobox]")?.focus()
      return
    }
    setMissing(null)
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
          onChange={(e) => {
            setTitle(e.target.value)
            if (missing === "title") setMissing(null)
          }}
          aria-invalid={missing === "title" || undefined}
          placeholder={m.newTitleHint}
          className={cx(
            "selectable h-[2.4rem] min-w-[16rem] flex-1 rounded-[0.35rem] border bg-app px-[0.625rem] text-[0.95rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand",
            missing === "title" ? "border-bad" : "border-line-strong",
          )}
        />
        <span ref={projectBox} className="inline-flex">
          <Select
            aria-label={m.project}
            {...(missing === "project" ? { "aria-invalid": true } : {})}
            value={project}
            placeholder={m.pickProject}
            onChange={(v) => {
              setProject(v)
              if (missing === "project") setMissing(null)
            }}
            options={projects.map((p) => ({ value: p.key, label: `${p.key} · ${p.name}` }))}
            className={cx("w-[13rem]", missing === "project" && "border-bad!")}
          />
        </span>
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
        <DateField
          aria-label={m.due}
          value={due}
          onChange={setDue}
          format={(day) => dueDay(new Date(`${day}T00:00:00`), lang)}
          className="w-[9.5rem]"
        />
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={close}>
            {m.cancel}
          </Button>
          <Button size="sm" type="submit" disabled={busy}>
            {busy ? m.saving : m.add}
          </Button>
        </span>
      </div>
      <Collapse open={missing !== null}>
        <p role="alert" className="text-[0.875rem] text-bad">
          {missing === "project" ? m.needProject : missing === "title" ? m.needTitle : ""}
        </p>
      </Collapse>
      {failed && <ErrorNotice inline>{m.notSaved(failed)}</ErrorNotice>}
    </form>
  )
}
