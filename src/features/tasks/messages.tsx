// cspell:words hermes Новые Отклонено Descartadas
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
  missing: string
  goTools: string
  old: (version: string | null, need: string) => string
  update: string
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
  chosen: (n: number) => string
  find: (what: string) => string
  noChoice: string
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
  sortBy: (column: string) => string
  waitsFor: (keys: string[]) => string
  onIt: (agent: string) => string
  forAgent: (agent: string) => string
  cell: (what: string, key: string) => string
  open: (key: string) => string
  notSaved: (reason: string) => string
  notMoved: (reason: string) => string
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
  notes: string
  notesHint: string
  save: string
  cancel: string
  saving: string
  agentHint: string
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
  openFailed: (key: string, reason: string) => string
  properties: string
  projectFixed: string
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
  dueFrom: string
  dueTo: string
  done: string
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
  missing:
    "Tasks are kept by Memo, which is not installed. Install it on the Tools page; you and your agents can then plan work here.",
  goTools: "Go to Tools",
  old: (version, need) =>
    `This page needs Memo ${need} or newer${version ? `; ${version} is installed` : ""}. Update Memo to see and move your tasks here.`,
  update: "Update Memo",
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
  searchHint: "Search tasks, or filter: project:HRB priority:high overdue:true",
  project: "Project",
  assignee: "Assignee",
  priority: "Priority",
  due: "Due",
  status: "Status",
  agent: "Agent",
  ready: "Can start now",
  chosen: (n) => `${n} chosen`,
  find: (what) => `Find ${what.toLowerCase()}`,
  noChoice: "No match",
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
  sortBy: (column) => `Sort by ${column.toLowerCase()}`,
  waitsFor: (keys) => `waits for ${formatList(keys, "en")}`,
  onIt: (agent) => `${agent} is on it`,
  forAgent: (agent) => `for ${agent}`,
  cell: (what, key) => `${what} of ${key}`,
  open: (key) => `Open ${key}`,
  notSaved: (reason) => `The change was not saved: ${reason}. Nothing changed.`,
  notMoved: (reason) => `Not moved: ${reason}. The card is back where it was.`,
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
  notes: "Notes",
  notesHint: "Anything you or an agent should know. Ctrl+Enter saves.",
  save: "Save",
  cancel: "Cancel",
  saving: "Saving…",
  agentHint: "An agent's name, such as hermes",
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
  openFailed: (key, reason) => `Could not read ${key}: ${reason}.`,
  properties: "Properties",
  projectFixed: "A task cannot move to another project yet.",
  key: "Key",
  kind: "Type",
  kinds: { bug: "Bug", feature: "Feature", chore: "Chore", task: "Task" },
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
  dueFrom: "From",
  dueTo: "To (optional)",
  done: "Done",
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
  missing:
    "Задачи хранит Memo, а он не установлен. Установите его на странице «Инструменты» — тогда вы и агенты сможете планировать работу здесь.",
  goTools: "К инструментам",
  old: (version, need) =>
    `Этой странице нужен Memo ${need} или новее${version ? `; установлен ${version}` : ""}. Обновите Memo, чтобы видеть и двигать задачи здесь.`,
  update: "Обновить Memo",
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
  searchHint: "Найти задачу или отфильтровать: project:HRB priority:high overdue:true",
  project: "Проект",
  assignee: "Исполнитель",
  priority: "Приоритет",
  due: "Срок",
  status: "Статус",
  agent: "Агент",
  ready: "Можно начать",
  chosen: (n) => `выбрано: ${n}`,
  find: (what) => `Найти: ${what.toLowerCase()}`,
  noChoice: "Ничего не найдено",
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
  sortBy: (column) => `Сортировать: ${column.toLowerCase()}`,
  waitsFor: (keys) => `ждёт ${formatList(keys, "ru")}`,
  onIt: (agent) => `${agent} работает над ней`,
  forAgent: (agent) => `для ${agent}`,
  cell: (what, key) => `${what} задачи ${key}`,
  open: (key) => `Открыть ${key}`,
  notSaved: (reason) => `Изменение не сохранено: ${reason}. Ничего не изменилось.`,
  notMoved: (reason) => `Не перенесено: ${reason}. Карточка вернулась на место.`,
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
  notes: "Заметки",
  notesHint: "Всё, что нужно знать вам или агенту. Ctrl+Enter сохраняет.",
  save: "Сохранить",
  cancel: "Отмена",
  saving: "Сохраняю…",
  agentHint: "Имя агента, например hermes",
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
  openFailed: (key, reason) => `Не удалось прочитать ${key}: ${reason}.`,
  properties: "Свойства",
  projectFixed: "Перенести задачу в другой проект пока нельзя.",
  key: "Ключ",
  kind: "Тип",
  kinds: { bug: "Ошибка", feature: "Функция", chore: "Рутина", task: "Задача" },
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
  dueFrom: "С",
  dueTo: "По (необязательно)",
  done: "Готово",
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
  missing:
    "Las tareas las guarda Memo, que no está instalado. Instálalo en la página Herramientas; entonces tú y tus agentes podréis planificar aquí.",
  goTools: "Ir a Herramientas",
  old: (version, need) =>
    `Esta página necesita Memo ${need} o posterior${version ? `; está instalado ${version}` : ""}. Actualiza Memo para ver y mover tus tareas aquí.`,
  update: "Actualizar Memo",
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
  searchHint: "Busca tareas o filtra: project:HRB priority:high overdue:true",
  project: "Proyecto",
  assignee: "Responsable",
  priority: "Prioridad",
  due: "Fecha límite",
  status: "Estado",
  agent: "Agente",
  ready: "Se puede empezar",
  chosen: (n) => `${n} elegidos`,
  find: (what) => `Buscar ${what.toLowerCase()}`,
  noChoice: "Sin coincidencias",
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
  sortBy: (column) => `Ordenar por ${column.toLowerCase()}`,
  waitsFor: (keys) => `espera a ${formatList(keys, "es")}`,
  onIt: (agent) => `${agent} está en ello`,
  forAgent: (agent) => `para ${agent}`,
  cell: (what, key) => `${what} de ${key}`,
  open: (key) => `Abrir ${key}`,
  notSaved: (reason) => `El cambio no se guardó: ${reason}. No cambió nada.`,
  notMoved: (reason) => `No se movió: ${reason}. La tarjeta volvió a su sitio.`,
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
  notes: "Notas",
  notesHint: "Lo que tú o un agente debéis saber. Ctrl+Enter guarda.",
  save: "Guardar",
  cancel: "Cancelar",
  saving: "Guardando…",
  agentHint: "Nombre de un agente, como hermes",
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
  openFailed: (key, reason) => `No se pudo leer ${key}: ${reason}.`,
  properties: "Propiedades",
  projectFixed: "Aún no se puede mover una tarea a otro proyecto.",
  key: "Clave",
  kind: "Tipo",
  kinds: { bug: "Error", feature: "Función", chore: "Mantenimiento", task: "Tarea" },
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
  dueFrom: "Desde",
  dueTo: "Hasta (opcional)",
  done: "Hecho",
}

export const taskMessages: Messages<Words> = { en, ru, es }
export type TaskWords = Words
