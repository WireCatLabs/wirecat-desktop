// cspell:words hermes Новые Отклонено Descartadas
import type { TaskFailure } from "@/domain/task-failure"
import type { Label, State } from "@/domain/tasks"
import { formatDate, formatList, formatNumber, type Lang, type Messages, plural } from "@/i18n"

type Words = {
  title: string
  intro: string
  guide: string
  readAgain: string
  reading: string
  view: string
  table: string
  board: string
  newTask: string
  states: Record<State, string>
  labels: Record<Label | "none", string>
  readFailed: string
  tryAgain: string
  badQuery: string
  empty: string
  emptyBody: string
  noMatch: string
  clear: string
  more: (total: number) => string
  search: string
  searchHint: string
  project: string
  assignee: string
  priority: string
  due: string
  status: string
  agent: string
  ready: string
  nobody: string
  you: string
  unnamed: string
  anyAgent: string
  overdue: string
  week: string
  noDate: string
  today: string
  tomorrow: string
  inWeek: string
  pickDate: string
  late: string
  task: string
  waitsFor: (keys: string[]) => string
  onIt: (agent: string) => string
  forAgent: (agent: string) => string
  fromMessages: string
  /** A task memo found in a message whose title is still only the message's address. */
  foundTitle: Record<string, string>
  priorityIs: (label: string) => string
  showMore: (left: number) => string
  source: string
  fromProjects: string
  fromChats: string
  onlyMine: string
  mail: string
  cell: (what: string, key: string) => string
  open: (key: string) => string
  notSaved: string
  notMoved: string
  failure: Record<TaskFailure, string>
  failureDetails: string
  changed: (key: string, who: string, what: string, at: string) => string
  changedUnknown: (key: string) => string
  someone: string
  nowLabel: (key: string, label: string) => string
  movedTo: (key: string, column: string) => string
  column: (name: string, n: number) => string
  last14: string
  emptyColumn: string
  moveTo: (key: string) => string
  draggable: string
  dragHint: string
  picked: (key: string) => string
  place: (column: string, at: number, of: number) => string
  dropped: (key: string, column: string) => string
  putBack: (key: string) => string
  titleField: string
  titleEmpty: string
  notes: string
  notesHint: string
  save: string
  cancel: string
  saving: string
  saved: string
  agentField: string
  agentTip: string
  foundOnly: string
  noProject: string
  sourceUnknown: string
  sourceNotMessage: string
  sourceReading: string
  sourceFailed: string
  sourceNoAccount: string
  sourceOldMemo: string
  sourceNotHere: string
  /** What the owner does next with a found task, by memo's kind of it. */
  nextStep: Record<string, string>
  openChat: string
  openMail: string
  saveBeforeOpen: string
  foundHidden: (n: number) => string
  agentNone: string
  waitsHeading: string
  nothingBlocks: string
  history: string
  historyEmpty: string
  historyFailed: string
  created: (who: string) => string
  changedField: (who: string, field: string, from: string, to: string) => string
  setField: (who: string, field: string, to: string) => string
  clearedField: (who: string, field: string) => string
  fields: Record<string, string>
  newTitle: string
  newTitleHint: string
  pickProject: string
  add: string
  noProjects: string
  details: (key: string) => string
  close: string
  previous: string
  next: string
  keysHint: string
  readingTask: string
  openFailed: (key: string) => string
  properties: string
  projectHint: string
  movedWith: (n: number) => string
  partOf: string
  moveAlone: (parent: string, project: string) => string
  someoneElse: string
  findPerson: string
  addNamed: (name: string) => string
  personFailed: (reason: string) => string
  comments: string
  commentsEmpty: string
  commentsFailed: string
  addComment: string
  commentHint: string
  commentEmpty: string
  send: string
  sending: string
  commentFailed: string
  key: string
  kind: string
  kinds: Record<string, string>
  parent: string
  createdAt: string
  createdBy: (when: string, who: string) => string
  updatedAt: string
  closedAt: string
  revision: string
  revisionHint: string
  holdsUp: string
  holdsUpHint: string
  byAgent: string
  byPerson: string
  editNotes: string
  customDay: string
  rangeStart: string
  rangeEnd: string
  done: string
  needTitle: string
  needProject: string
  saveFirst: string
  closeAgain: string
  stillSaving: string
  readWhy: string
  draftKept: string
  position: (at: number, of: number) => string
}

/** "4 Nov": a due day. */
export const dueDay = (iso: string | Date, lang: Lang) => formatDate(iso, { day: "numeric", month: "short" }, lang)
/** "4 Nov, 09:16": when a change was made. */
export const stamp = (iso: string, lang: Lang) =>
  formatDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, lang)

const en: Words = {
  title: "Tasks",
  intro: "What you and your agents plan to do, kept by WireCat. Agents read and change the same list.",
  guide: "How tasks work",
  readAgain: "Read again",
  reading: "Reading…",
  view: "View",
  table: "Table",
  board: "Board",
  newTask: "New task",
  states: { open: "Open", todo: "Todo", in_progress: "Progress", done: "Done", dismissed: "Dismissed" },
  labels: { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "No priority" },
  readFailed: "Could not read tasks.",
  tryAgain: "Try again",
  badQuery: "This search could not be read. Check the brackets and quotes, or clear it.",
  empty: "No tasks yet.",
  emptyBody:
    'Add one with New task, or ask an agent connected to WireCat: "add a task to send Kai the pricing table on Monday". Tasks you and your agents add appear here.',
  noMatch: "No task matches this search. Remove a filter above, or clear them all.",
  clear: "Clear",
  more: (total) => `Showing the first 500 of ${formatNumber(total, "en")} tasks. Narrow the search to see the rest.`,
  search: "Search tasks",
  searchHint: "Search tasks, or filter: project:HRB priority:high when:overdue",
  project: "Project",
  assignee: "Assignee",
  priority: "Priority",
  due: "Due",
  status: "Status",
  agent: "Agent",
  ready: "Can start now",
  nobody: "Nobody",
  you: "You",
  unnamed: "Unnamed person",
  anyAgent: "Any agent",
  overdue: "Overdue",
  week: "Next 7 days",
  noDate: "No date",
  today: "Today",
  tomorrow: "Tomorrow",
  inWeek: "In a week",
  pickDate: "Another day",
  late: "late",
  task: "Task",
  waitsFor: (keys) => `waits for ${formatList(keys, "en")}`,
  onIt: (agent) => `${agent} is on it`,
  forAgent: (agent) => `for ${agent}`,
  fromMessages: "Memo found this task in your messages.",
  foundTitle: {
    question: "Untitled question",
    request: "Untitled request",
    promise: "Untitled promise",
    mention: "Untitled mention",
    other: "Untitled task",
  },
  priorityIs: (label) => `Priority: ${label}`,
  showMore: (left) => `Show more (${formatNumber(left, "en")})`,
  source: "Source",
  fromProjects: "Projects",
  fromChats: "Chats and mail",
  onlyMine: "Only mine",
  mail: "Mail",
  cell: (what, key) => `${what} of ${key}`,
  open: (key) => `Open ${key}`,
  notSaved: "Not saved.",
  notMoved: "Not moved, the card is back.",
  failure: {
    account: "Memo could not tell which account the task belongs to. Read the tasks again, then retry.",
    projectOnly:
      "Memo found this task in your messages, and only project tasks have a status, priority, type, agent or project.",
    busy: "Memo is busy, most likely with a sync. Try again in a minute.",
    timeout: "Memo took too long to answer. Try again, and report it if it happens again.",
    missing: "Memo is not installed. Install it on the Tools page.",
    other: "Memo refused the change. The details say why.",
  },
  failureDetails: "Details",
  changed: (key, who, what, at) =>
    `${key} changed elsewhere: ${who} changed ${what} at ${at}. Your change was not saved; the task shows what it is now.`,
  changedUnknown: (key) => `${key} changed elsewhere. Your change was not saved; the task shows what it is now.`,
  someone: "someone",
  nowLabel: (key, label) => `${key} is now ${label}.`,
  movedTo: (key, column) => `${key} moved to ${column}.`,
  column: (name, n) => plural("en", n, { one: `${name}, # task`, other: `${name}, # tasks` }),
  last14: "Closed in the last 14 days",
  emptyColumn: "Nothing here. Drag a task in.",
  moveTo: (key) => `Move ${key} to…`,
  draggable: "draggable task",
  dragHint: "Space picks it up; arrow keys move it; Space drops it; Escape puts it back.",
  picked: (key) => `Picked up ${key}. Arrow keys move it, Space drops it, Escape puts it back.`,
  place: (column, at, of) => `${column}, place ${at} of ${of}.`,
  dropped: (key, column) => `Dropped ${key} in ${column}.`,
  putBack: (key) => `${key} put back.`,
  titleField: "Title",
  titleEmpty: "Enter a title for the task.",
  notes: "Notes",
  notesHint: "Anything you or an agent should know. Ctrl+Enter saves.",
  save: "Save",
  cancel: "Cancel",
  saving: "Saving…",
  saved: "Saved",
  agentField: "AI agent",
  agentTip:
    "The AI agent that should take this task, besides the assignee, written as its name, such as hermes. That agent sees the task as its own.",
  foundOnly:
    "Memo found this task in your messages, so it is not in a project. For such a task Memo keeps only the title, notes, due date and assignee, and three statuses: Open, Done and Dismissed. Priority, type, AI agent and project are kept for project tasks only, and Memo cannot move a task from messages into a project yet.",
  noProject: "No project",
  sourceUnknown: "Memo did not keep the message it found this task in.",
  sourceNotMessage: "Memo found this task in a note or a document, not in a chat.",
  sourceReading: "Reading the message…",
  sourceFailed: "Could not read the message.",
  sourceNoAccount:
    "The message is in an account no profile on this computer is signed in to. Sign in to it on the Tools page.",
  sourceOldMemo: "To show the message here, install or update Memo on the Tools page.",
  sourceNotHere: "The message is not on this computer: it was deleted, or its chat is not synced yet.",
  nextStep: {
    question:
      "Someone asked a question. Answer it in the chat, then mark the task Done. If no answer is needed, mark it Dismissed.",
    request:
      "Someone asked you to do something. Do it or answer in the chat, then mark the task Done. If it is not for you, mark it Dismissed.",
    promise: "You promised something here. Do it, then mark the task Done.",
    mention: "Someone mentioned you. Read the message; if nothing is needed, mark the task Dismissed.",
  },
  openChat: "Open in the chat",
  openMail: "Open the email",
  saveBeforeOpen: "Save or cancel your changes to the task first.",
  foundHidden: (n) =>
    `${formatNumber(n, "en")} ${n === 1 ? "task" : "tasks"} from messages are not shown: Memo applies search and filters to project tasks only. Clear the search to see them.`,
  agentNone: "No agent",
  waitsHeading: "Waits for",
  nothingBlocks: "Nothing. It can start now.",
  history: "History",
  historyEmpty: "No changes yet.",
  historyFailed: "Could not read the history.",
  created: (who) => `${who} created it`,
  changedField: (who, field, from, to) => `${who} changed ${field} from ${from} to ${to}`,
  setField: (who, field, to) => `${who} set ${field} to ${to}`,
  clearedField: (who, field) => `${who} cleared ${field}`,
  fields: {
    status: "the status",
    priority: "the priority",
    due_at: "the due date",
    agent: "the agent",
    assignee: "the assignee",
    title: "the title",
    description: "the notes",
    parent: "the parent task",
    project: "the project",
    key: "the key",
    type: "the type",
  },
  newTitle: "Title of the new task",
  newTitleHint: "What is to be done",
  pickProject: "Pick a project",
  add: "Add task",
  noProjects: "There is no project yet. Ask an agent to add one.",
  details: (key) => `Task ${key}`,
  close: "Close",
  previous: "Previous task",
  next: "Next task",
  keysHint: "J and K open the next and previous task; Escape closes.",
  readingTask: "Reading the task…",
  openFailed: (key) => `Could not read ${key}.`,
  properties: "Properties",
  projectHint: "Moving it to another project gives it a new key. The old key still finds it.",
  movedWith: (n) => plural("en", n, { one: "Its subtask moved with it:", other: "Its # subtasks moved with it:" }),
  partOf: "Not moved: this task is part of",
  moveAlone: (parent, project) => `Move it to ${project} on its own (it leaves ${parent})`,
  someoneElse: "Someone else…",
  findPerson: "Find or add a person",
  addNamed: (name) => `Add “${name}”`,
  personFailed: (reason) => `The person was not added: ${reason}.`,
  comments: "Comments",
  commentsEmpty: "No comments yet.",
  commentsFailed: "Could not read the comments.",
  addComment: "Add a comment",
  commentHint: "For you and your agents to read. Ctrl+Enter sends.",
  commentEmpty: "Write a comment first, then send it.",
  send: "Comment",
  sending: "Sending…",
  commentFailed: "The comment was not added. Your text is still here.",
  key: "Key",
  kind: "Type",
  kinds: {
    bug: "Bug",
    feature: "Feature",
    chore: "Chore",
    task: "Task",
    question: "Question",
    request: "Request",
    promise: "Promise",
    mention: "Mention",
  },
  parent: "Part of",
  createdAt: "Created",
  createdBy: (when, who) => `${when} by ${who}`,
  updatedAt: "Updated",
  closedAt: "Closed",
  revision: "Revision",
  revisionHint: "Goes up with every change. An edit made on an older revision is refused, not lost.",
  holdsUp: "Holds up",
  holdsUpHint: "Open tasks shown here that wait for this one.",
  byAgent: "an agent",
  byPerson: "a person",
  editNotes: "Edit",
  customDay: "Custom…",
  rangeStart: "Pick a day. Pick a second day to make it a range.",
  rangeEnd: "Now pick the last day of the range, or Done to keep one day.",
  done: "Done",
  needTitle: "Type a title for the task.",
  needProject: "Choose the project it belongs to.",
  saveFirst: "Finish what you typed first: save it, send it or clear it.",
  closeAgain: "What you typed is not saved. Close again to discard it.",
  stillSaving: "Still saving. You can close this once it is done.",
  readWhy: "The details say why.",
  draftKept: "What you typed is still in the form. Save to replace the other version, or Cancel to keep it.",
  position: (at, of) => `${at} of ${of}`,
}

const ru: Words = {
  title: "Задачи",
  intro: "Что вы и ваши агенты собираетесь сделать; хранит WireCat. Агенты читают и меняют тот же список.",
  guide: "Как устроены задачи",
  readAgain: "Прочитать заново",
  reading: "Читаю…",
  view: "Вид",
  table: "Таблица",
  board: "Доска",
  newTask: "Новая задача",
  states: { open: "Новые", todo: "К выполнению", in_progress: "В работе", done: "Готово", dismissed: "Отклонено" },
  labels: { critical: "Критичный", high: "Высокий", medium: "Средний", low: "Низкий", none: "Без приоритета" },
  readFailed: "Не удалось прочитать задачи.",
  tryAgain: "Ещё раз",
  badQuery: "Этот поиск не удалось прочитать. Проверьте скобки и кавычки или очистите его.",
  empty: "Задач пока нет.",
  emptyBody:
    "Добавьте задачу кнопкой «Новая задача» или попросите агента, подключённого к WireCat: «добавь задачу отправить Каю прайс в понедельник». Здесь появятся задачи ваши и агентов.",
  noMatch: "Под этот поиск ничего не подходит. Уберите фильтр выше или очистите все.",
  clear: "Очистить",
  more: (total) => `Показаны первые 500 из ${formatNumber(total, "ru")} задач. Сузьте поиск, чтобы увидеть остальные.`,
  search: "Поиск задач",
  searchHint: "Найти задачу или отфильтровать: project:HRB priority:high when:overdue",
  project: "Проект",
  assignee: "Исполнитель",
  priority: "Приоритет",
  due: "Срок",
  status: "Статус",
  agent: "Агент",
  ready: "Можно начать",
  nobody: "Никто",
  you: "Вы",
  unnamed: "Без имени",
  anyAgent: "Любой агент",
  overdue: "Просрочено",
  week: "Ближайшие 7 дней",
  noDate: "Без срока",
  today: "Сегодня",
  tomorrow: "Завтра",
  inWeek: "Через неделю",
  pickDate: "Другой день",
  late: "просрочено",
  task: "Задача",
  waitsFor: (keys) => `ждёт ${formatList(keys, "ru")}`,
  onIt: (agent) => `${agent} работает над ней`,
  forAgent: (agent) => `для ${agent}`,
  fromMessages: "Memo нашел эту задачу в ваших сообщениях.",
  foundTitle: {
    question: "Вопрос без названия",
    request: "Просьба без названия",
    promise: "Обещание без названия",
    mention: "Упоминание без названия",
    other: "Задача без названия",
  },
  priorityIs: (label) => `Приоритет: ${label}`,
  showMore: (left) => `Показать ещё (${formatNumber(left, "ru")})`,
  source: "Источник",
  fromProjects: "Проекты",
  fromChats: "Чаты и почта",
  onlyMine: "Только мои",
  mail: "Почта",
  cell: (what, key) => `${what} задачи ${key}`,
  open: (key) => `Открыть ${key}`,
  notSaved: "Не сохранено.",
  notMoved: "Не перенесено, карточка на месте.",
  failure: {
    account: "Memo не понял, к какому аккаунту относится задача. Обновите список и попробуйте снова.",
    projectOnly:
      "Memo нашел эту задачу в ваших сообщениях. Статус, приоритет, тип, агент и проект есть только у задач проекта.",
    busy: "Memo занят, скорее всего синхронизацией. Попробуйте через минуту.",
    timeout: "Memo слишком долго не отвечал. Попробуйте еще раз, а если повторится, сообщите об ошибке.",
    missing: "Memo не установлен. Установите его на странице Инструменты.",
    other: "Memo не принял изменение. Причина в подробностях.",
  },
  failureDetails: "Подробнее",
  changed: (key, who, what, at) =>
    `${key} изменили в другом месте: ${who} — ${what}, ${at}. Ваше изменение не сохранено; задача показана такой, какая она сейчас.`,
  changedUnknown: (key) =>
    `${key} изменили в другом месте. Ваше изменение не сохранено; задача показана такой, какая она сейчас.`,
  someone: "кто-то",
  nowLabel: (key, label) => `У ${key} теперь приоритет «${label}».`,
  movedTo: (key, column) => `${key} перенесена в «${column}».`,
  column: (name, n) =>
    plural("ru", n, {
      one: `${name}, # задача`,
      few: `${name}, # задачи`,
      many: `${name}, # задач`,
      other: `${name}, # задачи`,
    }),
  last14: "Закрытые за последние 14 дней",
  emptyColumn: "Пусто. Перетащите сюда задачу.",
  moveTo: (key) => `Перенести ${key} в…`,
  draggable: "перетаскиваемая задача",
  dragHint: "Пробел — взять; стрелки — двигать; пробел — положить; Escape — вернуть.",
  picked: (key) => `${key} взята. Стрелки двигают её, пробел кладёт, Escape возвращает.`,
  place: (column, at, of) => `${column}, место ${at} из ${of}.`,
  dropped: (key, column) => `${key} положена в «${column}».`,
  putBack: (key) => `${key} возвращена на место.`,
  titleField: "Название",
  titleEmpty: "Введите название задачи.",
  notes: "Заметки",
  notesHint: "Всё, что нужно знать вам или агенту. Ctrl+Enter сохраняет.",
  save: "Сохранить",
  cancel: "Отмена",
  saving: "Сохраняю…",
  saved: "Сохранено",
  agentField: "ИИ-агент",
  agentTip:
    "ИИ-агент, который должен взять задачу, помимо исполнителя. Пишется именем, например hermes. Этот агент видит задачу как свою.",
  foundOnly:
    "Memo нашел эту задачу в ваших сообщениях, поэтому она не входит в проект. У таких задач Memo хранит только название, заметки, срок и исполнителя и три статуса: «Новые», «Готово» и «Отклонено». Приоритет, тип, ИИ-агент и проект есть только у задач проекта, а перенести задачу из сообщений в проект Memo пока не умеет.",
  noProject: "Без проекта",
  sourceUnknown: "Memo не сохранил, в каком сообщении нашел эту задачу.",
  sourceNotMessage: "Memo нашел эту задачу в заметке или документе, а не в чате.",
  sourceReading: "Читаю сообщение…",
  sourceFailed: "Не удалось прочитать сообщение.",
  sourceNoAccount:
    "Сообщение в аккаунте, в который не вошел ни один профиль на этом компьютере. Войдите в него на странице «Инструменты».",
  sourceOldMemo: "Чтобы показать сообщение здесь, установите или обновите Memo на странице «Инструменты».",
  sourceNotHere: "Сообщения нет на этом компьютере: его удалили, или его чат еще не синхронизирован.",
  nextStep: {
    question:
      "Вам задали вопрос. Ответьте в чате, затем отметьте задачу «Готово». Если отвечать не нужно, отметьте «Отклонено».",
    request:
      "Вас о чем-то попросили. Сделайте это или ответьте в чате, затем отметьте задачу «Готово». Если просьба не к вам, отметьте «Отклонено».",
    promise: "Здесь вы что-то пообещали. Сделайте это, затем отметьте задачу «Готово».",
    mention: "Вас упомянули. Прочитайте сообщение; если делать ничего не нужно, отметьте задачу «Отклонено».",
  },
  openChat: "Открыть в чате",
  openMail: "Открыть письмо",
  saveBeforeOpen: "Сначала сохраните или отмените изменения в задаче.",
  foundHidden: (n) =>
    `Задачи из сообщений (${formatNumber(n, "ru")}) не показаны: Memo применяет поиск и фильтры только к задачам проектов. Очистите поиск, чтобы их увидеть.`,
  agentNone: "Без агента",
  waitsHeading: "Ждёт",
  nothingBlocks: "Ничего. Можно начинать.",
  history: "История",
  historyEmpty: "Изменений пока нет.",
  historyFailed: "Не удалось прочитать историю.",
  created: (who) => `${who} создал(а) задачу`,
  changedField: (who, field, from, to) => `${who} изменил(а) ${field}: ${from} → ${to}`,
  setField: (who, field, to) => `${who} изменил(а) ${field}: ${to}`,
  clearedField: (who, field) => `${who} убрал(а) ${field}`,
  fields: {
    status: "статус",
    priority: "приоритет",
    due_at: "срок",
    agent: "агент",
    assignee: "исполнитель",
    title: "название",
    description: "заметки",
    parent: "родительская задача",
    project: "проект",
    key: "ключ",
    type: "тип",
  },
  newTitle: "Название новой задачи",
  newTitleHint: "Что нужно сделать",
  pickProject: "Выберите проект",
  add: "Добавить",
  noProjects: "Проектов пока нет. Попросите агента добавить проект.",
  details: (key) => `Задача ${key}`,
  close: "Закрыть",
  previous: "Предыдущая задача",
  next: "Следующая задача",
  keysHint: "J и K открывают следующую и предыдущую задачу; Escape закрывает.",
  readingTask: "Читаю задачу…",
  openFailed: (key) => `Не удалось прочитать ${key}.`,
  properties: "Свойства",
  projectHint: "При переносе в другой проект у задачи будет новый ключ. По старому ее тоже можно найти.",
  movedWith: (n) =>
    plural("ru", n, {
      one: "Вместе с ней перенесена # подзадача:",
      few: "Вместе с ней перенесены # подзадачи:",
      many: "Вместе с ней перенесены # подзадач:",
      other: "Вместе с ней перенесены # подзадачи:",
    }),
  partOf: "Не перенесено: эта задача входит в",
  moveAlone: (parent, project) => `Перенести в ${project} отдельно (она выйдет из ${parent})`,
  someoneElse: "Кто-то другой…",
  findPerson: "Найти или добавить человека",
  addNamed: (name) => `Добавить «${name}»`,
  personFailed: (reason) => `Человек не добавлен: ${reason}.`,
  comments: "Комментарии",
  commentsEmpty: "Комментариев пока нет.",
  commentsFailed: "Не удалось прочитать комментарии.",
  addComment: "Добавить комментарий",
  commentHint: "Для вас и ваших агентов. Ctrl+Enter отправляет.",
  commentEmpty: "Сначала напишите комментарий, потом отправьте.",
  send: "Отправить",
  sending: "Отправка…",
  commentFailed: "Комментарий не добавлен. Ваш текст остался.",
  key: "Ключ",
  kind: "Тип",
  kinds: {
    bug: "Ошибка",
    feature: "Функция",
    chore: "Рутина",
    task: "Задача",
    question: "Вопрос",
    request: "Просьба",
    promise: "Обещание",
    mention: "Упоминание",
  },
  parent: "Часть задачи",
  createdAt: "Создана",
  createdBy: (when, who) => `${when}, автор: ${who}`,
  updatedAt: "Изменена",
  closedAt: "Закрыта",
  revision: "Ревизия",
  revisionHint: "Растёт с каждым изменением. Правка по старой ревизии отклоняется, а не теряется.",
  holdsUp: "Задерживает",
  holdsUpHint: "Открытые задачи на странице, которые ждут эту.",
  byAgent: "агент",
  byPerson: "человек",
  editNotes: "Изменить",
  customDay: "Другие даты…",
  rangeStart: "Выберите день. Второй выбранный день задаст период.",
  rangeEnd: "Теперь выберите последний день периода или нажмите «Готово», чтобы оставить один день.",
  done: "Готово",
  needTitle: "Введите название задачи.",
  needProject: "Выберите проект задачи.",
  saveFirst: "Сначала сохраните, отправьте или очистите набранный текст.",
  closeAgain: "Набранный текст не сохранен. Закройте еще раз, чтобы его отбросить.",
  stillSaving: "Еще сохраняю. Окно можно будет закрыть, когда закончу.",
  readWhy: "Причина в подробностях.",
  draftKept:
    "Ваш текст остался в форме. Сохраните, чтобы заменить другую версию, или нажмите «Отмена», чтобы оставить ее.",
  position: (at, of) => `${at} из ${of}`,
}

const es: Words = {
  title: "Tareas",
  intro: "Lo que tú y tus agentes pensáis hacer, guardado por WireCat. Los agentes leen y cambian la misma lista.",
  guide: "Cómo funcionan las tareas",
  readAgain: "Leer de nuevo",
  reading: "Leyendo…",
  view: "Vista",
  table: "Tabla",
  board: "Tablero",
  newTask: "Nueva tarea",
  states: { open: "Abiertas", todo: "Por hacer", in_progress: "En curso", done: "Hechas", dismissed: "Descartadas" },
  labels: { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", none: "Sin prioridad" },
  readFailed: "No se pudieron leer las tareas.",
  tryAgain: "Reintentar",
  badQuery: "No se pudo leer esta búsqueda. Revisa los paréntesis y las comillas, o bórrala.",
  empty: "Aún no hay tareas.",
  emptyBody:
    "Añade una con Nueva tarea, o pídeselo a un agente conectado a WireCat: «añade una tarea para enviar a Kai la tabla de precios el lunes». Aquí aparecen las tareas tuyas y de tus agentes.",
  noMatch: "Ninguna tarea coincide con esta búsqueda. Quita un filtro de arriba o bórralos todos.",
  clear: "Borrar",
  more: (total) =>
    `Se muestran las primeras 500 de ${formatNumber(total, "es")} tareas. Acota la búsqueda para ver el resto.`,
  search: "Buscar tareas",
  searchHint: "Busca tareas o filtra: project:HRB priority:high when:overdue",
  project: "Proyecto",
  assignee: "Responsable",
  priority: "Prioridad",
  due: "Fecha límite",
  status: "Estado",
  agent: "Agente",
  ready: "Se puede empezar",
  nobody: "Nadie",
  you: "Tú",
  unnamed: "Persona sin nombre",
  anyAgent: "Cualquier agente",
  overdue: "Vencidas",
  week: "Próximos 7 días",
  noDate: "Sin fecha",
  today: "Hoy",
  tomorrow: "Mañana",
  inWeek: "En una semana",
  pickDate: "Otro día",
  late: "vencida",
  task: "Tarea",
  waitsFor: (keys) => `espera a ${formatList(keys, "es")}`,
  onIt: (agent) => `${agent} está en ello`,
  forAgent: (agent) => `para ${agent}`,
  fromMessages: "Memo encontró esta tarea en tus mensajes.",
  foundTitle: {
    question: "Pregunta sin título",
    request: "Petición sin título",
    promise: "Promesa sin título",
    mention: "Mención sin título",
    other: "Tarea sin título",
  },
  priorityIs: (label) => `Prioridad: ${label}`,
  showMore: (left) => `Mostrar más (${formatNumber(left, "es")})`,
  source: "Origen",
  fromProjects: "Proyectos",
  fromChats: "Chats y correo",
  onlyMine: "Solo mías",
  mail: "Correo",
  cell: (what, key) => `${what} de ${key}`,
  open: (key) => `Abrir ${key}`,
  notSaved: "No se guardó.",
  notMoved: "No se movió, la tarjeta volvió a su sitio.",
  failure: {
    account: "Memo no supo a qué cuenta pertenece la tarea. Vuelve a leer las tareas e inténtalo de nuevo.",
    projectOnly:
      "Memo encontró esta tarea en tus mensajes, y solo las tareas de un proyecto tienen estado, prioridad, tipo, agente o proyecto.",
    busy: "Memo está ocupado, seguramente con una sincronización. Inténtalo dentro de un minuto.",
    timeout: "Memo tardó demasiado en responder. Inténtalo de nuevo y, si se repite, avísanos.",
    missing: "Memo no está instalado. Instálalo en la página Herramientas.",
    other: "Memo rechazó el cambio. Los detalles dicen por qué.",
  },
  failureDetails: "Detalles",
  changed: (key, who, what, at) =>
    `${key} cambió en otro sitio: ${who} cambió ${what} a las ${at}. Tu cambio no se guardó; la tarea muestra cómo está ahora.`,
  changedUnknown: (key) => `${key} cambió en otro sitio. Tu cambio no se guardó; la tarea muestra cómo está ahora.`,
  someone: "alguien",
  nowLabel: (key, label) => `${key} ahora tiene prioridad ${label}.`,
  movedTo: (key, column) => `${key} pasó a ${column}.`,
  column: (name, n) => plural("es", n, { one: `${name}, # tarea`, other: `${name}, # tareas` }),
  last14: "Cerradas en los últimos 14 días",
  emptyColumn: "Nada aquí. Arrastra una tarea.",
  moveTo: (key) => `Mover ${key} a…`,
  draggable: "tarea arrastrable",
  dragHint: "Espacio la toma; las flechas la mueven; Espacio la suelta; Escape la devuelve.",
  picked: (key) => `${key} tomada. Las flechas la mueven, Espacio la suelta, Escape la devuelve.`,
  place: (column, at, of) => `${column}, puesto ${at} de ${of}.`,
  dropped: (key, column) => `${key} soltada en ${column}.`,
  putBack: (key) => `${key} devuelta a su sitio.`,
  titleField: "Título",
  titleEmpty: "Escribe un título para la tarea.",
  notes: "Notas",
  notesHint: "Lo que tú o un agente debéis saber. Ctrl+Enter guarda.",
  save: "Guardar",
  cancel: "Cancelar",
  saving: "Guardando…",
  saved: "Guardado",
  agentField: "Agente de IA",
  agentTip:
    "El agente de IA que debe tomar esta tarea, además del responsable, escrito por su nombre, como hermes. Ese agente la ve como suya.",
  foundOnly:
    "Memo encontró esta tarea en tus mensajes, así que no está en un proyecto. De estas tareas Memo guarda solo el título, las notas, la fecha límite y el responsable, y tres estados: Abiertas, Hechas y Descartadas. La prioridad, el tipo, el agente de IA y el proyecto son solo de las tareas de un proyecto, y Memo aún no puede mover una tarea de los mensajes a un proyecto.",
  noProject: "Sin proyecto",
  sourceUnknown: "Memo no guardó el mensaje en el que encontró esta tarea.",
  sourceNotMessage: "Memo encontró esta tarea en una nota o un documento, no en un chat.",
  sourceReading: "Leyendo el mensaje…",
  sourceFailed: "No se pudo leer el mensaje.",
  sourceNoAccount:
    "El mensaje está en una cuenta en la que ningún perfil de este ordenador ha iniciado sesión. Inicia sesión en Herramientas.",
  sourceOldMemo: "Para ver el mensaje aquí, instala o actualiza Memo en Herramientas.",
  sourceNotHere: "El mensaje no está en este ordenador: se borró, o su chat aún no está sincronizado.",
  nextStep: {
    question:
      "Te hicieron una pregunta. Respóndela en el chat y marca la tarea como Hecha. Si no hace falta responder, márcala como Descartada.",
    request:
      "Te pidieron algo. Hazlo o responde en el chat y marca la tarea como Hecha. Si no es para ti, márcala como Descartada.",
    promise: "Aquí prometiste algo. Hazlo y marca la tarea como Hecha.",
    mention: "Te mencionaron. Lee el mensaje; si no hace falta nada, marca la tarea como Descartada.",
  },
  openChat: "Abrir en el chat",
  openMail: "Abrir el correo",
  saveBeforeOpen: "Primero guarda o cancela los cambios de la tarea.",
  foundHidden: (n) =>
    `Las tareas de los mensajes (${formatNumber(n, "es")}) no se muestran: Memo aplica la búsqueda y los filtros solo a las tareas de proyectos. Borra la búsqueda para verlas.`,
  agentNone: "Sin agente",
  waitsHeading: "Espera a",
  nothingBlocks: "Nada. Se puede empezar ya.",
  history: "Historial",
  historyEmpty: "Aún sin cambios.",
  historyFailed: "No se pudo leer el historial.",
  created: (who) => `${who} la creó`,
  changedField: (who, field, from, to) => `${who} cambió ${field} de ${from} a ${to}`,
  setField: (who, field, to) => `${who} puso ${field} en ${to}`,
  clearedField: (who, field) => `${who} quitó ${field}`,
  fields: {
    status: "el estado",
    priority: "la prioridad",
    due_at: "la fecha límite",
    agent: "el agente",
    assignee: "el responsable",
    title: "el título",
    description: "las notas",
    parent: "la tarea madre",
    project: "el proyecto",
    key: "la clave",
    type: "el tipo",
  },
  newTitle: "Título de la nueva tarea",
  newTitleHint: "Qué hay que hacer",
  pickProject: "Elige un proyecto",
  add: "Añadir tarea",
  noProjects: "Aún no hay proyectos. Pide a un agente que añada uno.",
  details: (key) => `Tarea ${key}`,
  close: "Cerrar",
  previous: "Tarea anterior",
  next: "Tarea siguiente",
  keysHint: "J y K abren la tarea siguiente y la anterior; Escape cierra.",
  readingTask: "Leyendo la tarea…",
  openFailed: (key) => `No se pudo leer ${key}.`,
  properties: "Propiedades",
  projectHint: "Al moverla a otro proyecto recibe una clave nueva. La antigua también la encuentra.",
  movedWith: (n) =>
    plural("es", n, { one: "Su subtarea se movió con ella:", other: "Sus # subtareas se movieron con ella:" }),
  partOf: "No se ha movido: esta tarea forma parte de",
  moveAlone: (parent, project) => `Moverla sola a ${project} (sale de ${parent})`,
  someoneElse: "Otra persona…",
  findPerson: "Busca o añade a una persona",
  addNamed: (name) => `Añadir «${name}»`,
  personFailed: (reason) => `No se ha añadido a la persona: ${reason}.`,
  comments: "Comentarios",
  commentsEmpty: "Aún no hay comentarios.",
  commentsFailed: "No se han podido leer los comentarios.",
  addComment: "Añadir un comentario",
  commentHint: "Para ti y tus agentes. Ctrl+Enter lo envía.",
  commentEmpty: "Escribe primero un comentario y luego envíalo.",
  send: "Comentar",
  sending: "Enviando…",
  commentFailed: "No se ha añadido el comentario. Tu texto sigue aquí.",
  key: "Clave",
  kind: "Tipo",
  kinds: {
    bug: "Error",
    feature: "Función",
    chore: "Mantenimiento",
    task: "Tarea",
    question: "Pregunta",
    request: "Petición",
    promise: "Promesa",
    mention: "Mención",
  },
  parent: "Parte de",
  createdAt: "Creada",
  createdBy: (when, who) => `${when}, por ${who}`,
  updatedAt: "Cambiada",
  closedAt: "Cerrada",
  revision: "Revisión",
  revisionHint: "Sube con cada cambio. Una edición hecha sobre una revisión anterior se rechaza, no se pierde.",
  holdsUp: "Retiene",
  holdsUpHint: "Tareas abiertas mostradas aquí que esperan a esta.",
  byAgent: "un agente",
  byPerson: "una persona",
  editNotes: "Editar",
  customDay: "Personalizado…",
  rangeStart: "Elige un día. Un segundo día lo convierte en un periodo.",
  rangeEnd: "Ahora elige el último día del periodo, o pulsa Listo para quedarte con un solo día.",
  done: "Hecho",
  needTitle: "Escribe un título para la tarea.",
  needProject: "Elige el proyecto de la tarea.",
  saveFirst: "Primero guarda, envía o borra lo que escribiste.",
  closeAgain: "Lo que escribiste no está guardado. Cierra otra vez para descartarlo.",
  stillSaving: "Aún guardando. Podrás cerrar cuando termine.",
  readWhy: "Los detalles dicen por qué.",
  draftKept:
    "Lo que escribiste sigue en el formulario. Guarda para reemplazar la otra versión o pulsa Cancelar para conservarla.",
  position: (at, of) => `${at} de ${of}`,
}

export const taskMessages: Messages<Words> = { en, ru, es }
export type TaskWords = Words
