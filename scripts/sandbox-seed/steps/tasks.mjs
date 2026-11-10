import { dayOf, memo, memoAll, memoEach } from "../lib.mjs"
import { PHONE, smsRef } from "./phone.mjs"

const ALL_STATES = "state:(open OR todo OR in_progress OR done OR dismissed)"
const seedId = (id) => `seed:${id}`

function ensureProjects(ctx, projects) {
  const have = new Set(memo(["projects", "list"]).items.map((p) => p.key))
  let added = 0
  for (const p of projects.filter((p) => !have.has(p.key))) {
    const org = p.organization ? ["--organization", ctx.refs.get(p.organization)] : []
    memo(["projects", "add", p.name, "--key", p.key, "--type", p.type, ...org])
    added++
  }
  return added
}

/** `--external-id` is not unique in memo, so the seed id is looked up first; due dates are set once, at creation. */
function ensureProjectTasks(ctx, tasks) {
  const have = new Map(memoAll(["tasks", "list", "--", `project:* ${ALL_STATES}`]).map((t) => [t.external_id, t]))
  let added = 0
  let updated = 0
  for (const t of tasks) {
    const assignee = t.assignee ? ["--assignee", ctx.refs.get(t.assignee)] : []
    const old = have.get(seedId(t.id))
    if (!old) {
      memo([
        "tasks",
        "add",
        "--project",
        t.project,
        "--title",
        t.title,
        "--status",
        t.status,
        "--external-id",
        seedId(t.id),
        ...(t.priority ? ["--priority", t.priority] : []),
        ...(t.type ? ["--type", t.type] : []),
        ...(t.due_in_days !== undefined ? ["--due", dayOf(ctx.anchor, -t.due_in_days, "17:00").toISOString()] : []),
        ...assignee,
      ])
      added++
      continue
    }
    const change = [
      ...(old.title !== t.title ? ["--title", t.title] : []),
      ...(old.state !== t.status ? ["--status", t.status] : []),
      ...((old.priority_label ?? null) !== (t.priority ?? null) ? ["--priority", t.priority ?? "none"] : []),
    ]
    if (change.length) {
      memo(["tasks", "update", old.key, ...change])
      updated++
    }
  }
  return `${added} tasks added, ${updated} updated`
}

/** Tasks found in an SMS: the "from chats" side of the Tasks page and the task sources on Analytics. */
function ensureChatTasks(ctx, chatTasks) {
  const { messages } = ctx.data("phone.json")
  const account = `${PHONE.provider}:${PHONE.account}`
  const have = new Set(
    memoEach(["tasks", "list", "--source", account], "state", ["open", "done", "dismissed"]).map((t) => t.external_id),
  )
  let added = 0
  for (const t of chatTasks.filter((t) => !have.has(seedId(t.id)))) {
    const message = messages.find((m) => m.id === t.message)
    memo([
      "tasks",
      "add",
      smsRef(message),
      "--account",
      account,
      "--type",
      t.type,
      "--title",
      t.title,
      "--external-id",
      seedId(t.id),
      "--new",
    ])
    added++
  }
  return `${added} chat tasks added`
}

export default function tasks(ctx) {
  const data = ctx.data("projects.json")
  const projects = ensureProjects(ctx, data.projects)
  return [
    `${projects} projects added`,
    ensureProjectTasks(ctx, data.tasks),
    ensureChatTasks(ctx, data.chat_tasks),
  ].join(", ")
}
