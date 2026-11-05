// cspell:words hermes Kai Moreno Ruiz Ortiz
import type { Lang } from "@/i18n"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import type { SearchAnswer } from "@/platform/search-schemas"
import type { Person, Task } from "@/platform/task-schemas"
import { useMemory } from "../memory/store"
import { useSearch } from "../search/store"
import { useTasks } from "../tasks/store"

// The tour's example rows live only in the pages' stores, and the pages are inert while they show: memo's store
// belongs to the tools (rules 1 and 5). Rust refuses refs like `memory:example-1`, so a stray write could not land.

export type DemoPage = "memory" | "tasks" | "search"
/** What one stop opens among a page's examples: a search result, a memory's sources. */
export type DemoScene = "hit" | "sources"

const HOUR = 3_600_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const inDays = (n: number) => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).toISOString()
}

type MemoryText = {
  kai: string
  ana: string
  launch: string
  you: string
  task: string
  taskReason: string
  harbour: string
}

const MEMORY_TEXT: Record<Lang, MemoryText> = {
  en: {
    kai: "Kai Moreno prefers calls on Friday afternoons and asks for the agenda the evening before.",
    ana: "Ana Ruiz promised to send the signed contract by Thursday.",
    launch: "The Harbour launch moves to 2 March; the pilot with two clinics stays in February.",
    you: "You answer work mail in the morning and keep evenings free of calls.",
    task: "Send Kai the pricing table with the clinic discount",
    taskReason: "Kai asked for the pricing table twice this week.",
    harbour: "Project Harbour",
  },
  ru: {
    kai: "Кай Морено предпочитает созвоны в пятницу после обеда и просит повестку накануне вечером.",
    ana: "Ана Руис обещала прислать подписанный договор до четверга.",
    launch: "Запуск Harbour переносится на 2 марта; пилот с двумя клиниками остаётся в феврале.",
    you: "Вы отвечаете на рабочую почту по утрам, а вечера оставляете без созвонов.",
    task: "Отправить Каю таблицу цен со скидкой для клиник",
    taskReason: "Кай дважды за неделю просил таблицу цен.",
    harbour: "Проект Harbour",
  },
  es: {
    kai: "Kai Moreno prefiere las llamadas los viernes por la tarde y pide el orden del día la víspera.",
    ana: "Ana Ruiz prometió enviar el contrato firmado antes del jueves.",
    launch: "El lanzamiento de Harbour pasa al 2 de marzo; el piloto con dos clínicas sigue en febrero.",
    you: "Respondes el correo de trabajo por la mañana y dejas las tardes sin llamadas.",
    task: "Enviar a Kai la tabla de precios con el descuento para clínicas",
    taskReason: "Kai pidió la tabla de precios dos veces esta semana.",
    harbour: "Proyecto Harbour",
  },
}

const NAMES: Record<Lang, { kai: string; ana: string }> = {
  en: { kai: "Kai Moreno", ana: "Ana Ruiz" },
  ru: { kai: "Кай Морено", ana: "Ана Руис" },
  es: { kai: "Kai Moreno", ana: "Ana Ruiz" },
}

const blank = {
  summary: null,
  verb: null,
  targetName: null,
  chatName: null,
  counts: null,
  subject: null,
  subjectName: null,
  subjectIsOwner: false,
  scope: "work",
  project: null,
  projectName: null,
  supersedes: null,
  reason: null,
  account: null,
  target: null,
  updatedAt: null,
  findings: null,
  task: null,
  model: null,
  confidence: null,
} as const

const bot = (name: string) => ({ type: "bot", name })

export function demoMemory(lang: Lang): MemoryEntry[] {
  const t = MEMORY_TEXT[lang]
  const n = NAMES[lang]
  return [
    {
      ...blank,
      ref: "memory:example-1",
      type: "memory",
      kind: "preference",
      text: t.kai,
      status: "proposed",
      subject: "person:example-1",
      subjectName: n.kai,
      author: bot("claude-code"),
      links: 3,
      createdAt: ago(2 * HOUR),
    },
    {
      ...blank,
      ref: "action:example-2",
      type: "action",
      kind: "create_task",
      text: t.task,
      summary: t.task,
      verb: "create_task",
      targetName: n.kai,
      chatName: n.kai,
      status: "proposed",
      subject: "person:example-1",
      subjectName: n.kai,
      author: bot("hermes"),
      links: 0,
      reason: t.taskReason,
      scope: null,
      createdAt: ago(3 * HOUR),
    },
    {
      ...blank,
      ref: "fact:example-3",
      type: "fact",
      kind: "promise",
      text: t.ana,
      status: "proposed",
      subject: "person:example-2",
      subjectName: n.ana,
      author: bot("hermes"),
      links: 1,
      createdAt: ago(5 * HOUR),
    },
    {
      ...blank,
      ref: "fact:example-4",
      type: "fact",
      kind: "decision",
      text: t.launch,
      status: "confirmed",
      project: "project:example",
      projectName: t.harbour,
      subject: "project:example",
      subjectName: t.harbour,
      author: bot("claude-code"),
      links: 2,
      createdAt: ago(26 * HOUR),
    },
    {
      ...blank,
      ref: "memory:example-5",
      type: "memory",
      kind: "preference",
      text: t.you,
      status: "confirmed",
      subjectIsOwner: true,
      author: bot("claude-code"),
      links: 4,
      createdAt: ago(50 * HOUR),
    },
  ]
}

type SourceText = { friday: string; agenda: string; call: string; chat: string; subject: string }

const SOURCE_TEXT: Record<Lang, SourceText> = {
  en: {
    friday: "Fridays after lunch work best for me, mornings are packed.",
    agenda: "Could you send the agenda the evening before? I like to read it first.",
    call: "Friday 15:00 again? Agenda tonight, please.",
    chat: "Harbour team",
    subject: "Re: Friday call",
  },
  ru: {
    friday: "Мне удобнее всего по пятницам после обеда, утро занято.",
    agenda: "Можете прислать повестку накануне вечером? Хочу прочитать заранее.",
    call: "Снова в пятницу в 15:00? Повестку вечером, пожалуйста.",
    chat: "Команда Harbour",
    subject: "Re: пятничный созвон",
  },
  es: {
    friday: "Los viernes después de comer me van mejor, las mañanas las tengo llenas.",
    agenda: "¿Puedes enviar el orden del día la víspera? Me gusta leerlo antes.",
    call: "¿Otra vez el viernes a las 15:00? El orden del día esta noche, por favor.",
    chat: "Equipo Harbour",
    subject: "Re: llamada del viernes",
  },
}

export const DEMO_MEMORY = "memory:example-1"

export function demoSources(lang: Lang): MemorySource[] {
  const t = SOURCE_TEXT[lang]
  const kai = NAMES[lang].kai
  const source = { tool: null, missing: false }
  return [
    {
      ...source,
      ref: "tg:example-1",
      kind: "message",
      sender: kai,
      title: null,
      at: ago(9 * 24 * HOUR),
      excerpt: t.friday,
    },
    {
      ...source,
      ref: "email:example-2",
      kind: "mail",
      sender: kai,
      title: t.subject,
      at: ago(6 * 24 * HOUR),
      excerpt: t.agenda,
    },
    {
      ...source,
      ref: "tg:example-3",
      kind: "message",
      sender: kai,
      title: t.chat,
      at: ago(28 * HOUR),
      excerpt: t.call,
    },
  ]
}

type SearchText = { ask: string; query: string; chat: string; hits: [string, string, string] }

const SEARCH_TEXT: Record<Lang, SearchText> = {
  en: {
    ask: "what Ana said about the contract this month",
    query: 'contract from:"Ana Ruiz" date>=30d',
    chat: "Harbour team",
    hits: [
      "I'll send the signed contract by Thursday, the clinic annex is in it too.",
      "The contract is with our lawyer, two small changes on page 3.",
      "Do you want the contract in Spanish as well, or English only?",
    ],
  },
  ru: {
    ask: "что Ана писала про договор в этом месяце",
    query: 'договор from:"Ана Руис" date>=30d',
    chat: "Команда Harbour",
    hits: [
      "Пришлю подписанный договор до четверга, приложение для клиник тоже в нём.",
      "Договор у нашего юриста, две небольшие правки на странице 3.",
      "Договор нужен и на испанском, или только на английском?",
    ],
  },
  es: {
    ask: "qué dijo Ana del contrato este mes",
    query: 'contrato from:"Ana Ruiz" date>=30d',
    chat: "Equipo Harbour",
    hits: [
      "Enviaré el contrato firmado antes del jueves, el anexo de las clínicas también va.",
      "El contrato lo tiene nuestra abogada, dos cambios pequeños en la página 3.",
      "¿Quieres el contrato también en español, o solo en inglés?",
    ],
  },
}

const SEARCH_TOOL = "tg"
const SEARCH_PROFILE = "personal"

export function demoSearch(lang: Lang): Extract<SearchAnswer, { kind: "hits" }> {
  const t = SEARCH_TEXT[lang]
  const ana = NAMES[lang].ana
  const chats = [ana, t.chat, ana]
  const hours = [5, 50, 240]
  return {
    kind: "hits",
    hits: t.hits.map((text, i) => ({
      ref: `tg:example-${i + 1}`,
      timestamp: ago((hours[i] ?? 1) * HOUR),
      chat_title: chats[i],
      sender_name: ana,
      sender_is_me: false,
      text,
    })),
    hasMore: false,
    paged: false,
    notes: [],
    total: null,
  }
}

type TaskText = { pricing: string; clinics: string; announce: string; contract: string; agenda: string }

const TASK_TEXT: Record<Lang, TaskText> = {
  en: {
    pricing: "Send Kai the pricing table with the clinic discount",
    clinics: "Book the two pilot clinics for February",
    announce: "Draft the launch announcement for 2 March",
    contract: "Check the signed contract from Ana",
    agenda: "Agenda for the Friday call with Kai",
  },
  ru: {
    pricing: "Отправить Каю таблицу цен со скидкой для клиник",
    clinics: "Договориться с двумя пилотными клиниками на февраль",
    announce: "Подготовить анонс запуска к 2 марта",
    contract: "Проверить подписанный договор от Аны",
    agenda: "Повестка пятничного созвона с Каем",
  },
  es: {
    pricing: "Enviar a Kai la tabla de precios con el descuento para clínicas",
    clinics: "Reservar las dos clínicas piloto para febrero",
    announce: "Redactar el anuncio del lanzamiento del 2 de marzo",
    contract: "Revisar el contrato firmado de Ana",
    agenda: "Orden del día de la llamada del viernes con Kai",
  },
}

const OWNER = "person:example-0"
const ANA = "person:example-2"

export function demoPeople(lang: Lang): Person[] {
  return [
    { ref: OWNER, name: null, owner: true },
    { ref: "person:example-1", name: NAMES[lang].kai, owner: false },
    { ref: ANA, name: NAMES[lang].ana, owner: false },
  ]
}

export function demoTasks(lang: Lang): Task[] {
  const t = TASK_TEXT[lang]
  const project = "EX"
  const base: Omit<Task, "key" | "title" | "state" | "priority" | "priorityLabel" | "assignees" | "dueAt"> = {
    project,
    projectName: MEMORY_TEXT[lang].harbour,
    createdBy: { type: "person", name: null, owner: true },
    description: null,
    kind: "chore",
    agent: null,
    revision: 1,
    parent: null,
    closedAt: null,
    claimedBy: null,
    claimedUntil: null,
    ready: true,
    blockedBy: [],
    createdAt: ago(72 * HOUR),
    updatedAt: ago(2 * HOUR),
  }
  return [
    {
      ...base,
      key: "EX-1",
      title: t.clinics,
      state: "todo",
      priority: 0.86,
      priorityLabel: "critical",
      assignees: [ANA],
      dueAt: inDays(-1),
    },
    {
      ...base,
      key: "EX-2",
      title: t.pricing,
      state: "in_progress",
      priority: 0.7,
      priorityLabel: "high",
      assignees: [OWNER],
      dueAt: inDays(2),
      createdBy: { type: "bot", name: "hermes", owner: false },
    },
    {
      ...base,
      key: "EX-3",
      title: t.announce,
      state: "todo",
      priority: 0.4,
      priorityLabel: "medium",
      assignees: [OWNER],
      agent: "claude-code",
      dueAt: inDays(18),
      ready: false,
      blockedBy: [{ key: "EX-1", state: "todo" }],
    },
    {
      ...base,
      key: "EX-4",
      title: t.contract,
      state: "todo",
      priority: 0.3,
      priorityLabel: "medium",
      assignees: [],
      dueAt: inDays(3),
      createdBy: { type: "bot", name: "hermes", owner: false },
    },
    {
      ...base,
      key: "EX-5",
      title: t.agenda,
      state: "done",
      priority: 0.2,
      priorityLabel: "low",
      assignees: [OWNER],
      dueAt: null,
      closedAt: ago(20 * HOUR),
    },
  ]
}

const MEMORY_KEYS = [
  "read",
  "entries",
  "error",
  "reading",
  "tab",
  "query",
  "open",
  "held",
  "leaving",
  "arriving",
  "sources",
] as const
const TASK_KEYS = [
  "query",
  "unusable",
  "reading",
  "loaded",
  "error",
  "badQuery",
  "tasks",
  "order",
  "total",
  "more",
  "people",
  "assigned",
  "open",
  "creating",
  "view",
] as const
const SEARCH_KEYS = [
  "tool",
  "profile",
  "profiles",
  "profilesError",
  "query",
  "answer",
  "asked",
  "loading",
  "error",
  "expanded",
  "groupBy",
] as const

const pick = <T extends object, K extends keyof T>(state: T, keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, state[k]])) as Pick<T, K>

let memoryBefore: Pick<ReturnType<typeof useMemory.getState>, (typeof MEMORY_KEYS)[number]> | null = null
let tasksBefore: Pick<ReturnType<typeof useTasks.getState>, (typeof TASK_KEYS)[number]> | null = null
let searchBefore: Pick<ReturnType<typeof useSearch.getState>, (typeof SEARCH_KEYS)[number]> | null = null

/** Puts the example rows on one page; what the page held before comes back with `hideDemo`. */
export function showDemo(page: DemoPage, lang: Lang) {
  if (page === "memory") {
    if (useMemory.getState().demo) return
    memoryBefore = pick(useMemory.getState(), MEMORY_KEYS)
    const entries = demoMemory(lang)
    useMemory.setState({
      demo: true,
      read: { kind: "ready", entries, more: false, activity: null, activityError: null },
      entries,
      error: null,
      reading: false,
      tab: "all",
      query: "",
      open: null,
      held: [],
      leaving: [],
      arriving: [],
      sources: { [DEMO_MEMORY]: { state: "ready", sources: demoSources(lang) } },
    })
    return
  }
  if (page === "search") {
    if (useSearch.getState().demo) return
    searchBefore = pick(useSearch.getState(), SEARCH_KEYS)
    const t = SEARCH_TEXT[lang]
    useSearch.setState({
      demo: true,
      demoAsk: t.ask,
      tool: SEARCH_TOOL,
      profile: SEARCH_PROFILE,
      profiles: [{ name: SEARCH_PROFILE, signedIn: true }],
      profilesError: null,
      query: t.query,
      answer: demoSearch(lang),
      asked: { tool: SEARCH_TOOL, profile: SEARCH_PROFILE, query: t.query, page: 1 },
      loading: false,
      error: null,
      expanded: null,
      groupBy: null,
    })
    return
  }
  if (useTasks.getState().demo) return
  tasksBefore = pick(useTasks.getState(), TASK_KEYS)
  const tasks = demoTasks(lang)
  useTasks.setState({
    demo: true,
    query: "",
    unusable: null,
    reading: false,
    loaded: true,
    error: null,
    badQuery: null,
    tasks,
    order: tasks.map((t) => t.key),
    total: tasks.length,
    more: false,
    people: demoPeople(lang),
    assigned: [...new Set(tasks.flatMap((t) => t.assignees))],
    open: null,
    creating: false,
    view: "table",
  })
}

/** Opens what one stop points at among the examples; a stop with no scene shows them all closed. */
export function stageDemo(page: DemoPage, scene: DemoScene | null) {
  if (page === "memory" && useMemory.getState().demo)
    useMemory.setState({ open: scene === "sources" ? DEMO_MEMORY : null })
  if (page === "search" && useSearch.getState().demo) {
    const first = useSearch.getState().answer
    const ref = first?.kind === "hits" ? first.hits[0]?.ref : null
    useSearch.setState({ expanded: scene === "hit" && typeof ref === "string" ? `0:${ref}` : null })
  }
}

export function hideDemo(page: DemoPage) {
  if (page === "memory") {
    if (!useMemory.getState().demo) return
    useMemory.setState({ ...memoryBefore, reading: false, demo: false })
    memoryBefore = null
    return
  }
  if (page === "search") {
    if (!useSearch.getState().demo) return
    const before = searchBefore
    useSearch.setState({ ...before, loading: false, demo: false, demoAsk: "" })
    searchBefore = null
    // A profile list that arrived while the examples showed was dropped: ask for it again.
    if (before?.tool && before.profiles === undefined) {
      useSearch.setState({ tool: null })
      useSearch.getState().chooseTool(before.tool)
    }
    return
  }
  if (!useTasks.getState().demo) return
  useTasks.setState({ ...tasksBefore, reading: false, demo: false })
  tasksBefore = null
}
