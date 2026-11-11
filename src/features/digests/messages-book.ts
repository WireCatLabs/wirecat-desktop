import { type Messages, plural } from "@/i18n"

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
export type Source = "telegram" | "max" | "whatsapp" | "mail" | "meetings" | "tasks"
export const SOURCES: readonly Source[] = ["telegram", "mail", "meetings", "tasks", "max", "whatsapp"]

const WORKWEEK = ["mon", "tue", "wed", "thu", "fri"]
const WEEKEND = ["sat", "sun"]
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))
const ordered = (days: readonly string[]) => WEEKDAYS.filter((d) => days.includes(d))

/** "08:30", "08:30 and 18:00", "08:30, 13:00 and 18:00". */
const list = (items: readonly string[], and: string) =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`

const en = {
  create: "Create digest",
  table: "Digests",
  col: {
    name: "Name",
    when: "How often",
    sources: "Takes from",
    routes: "Sends to",
    last: "Run",
    scheduled: "On schedule",
  },
  morning: "Morning digest",
  nextAt: (when: string) => `Next: ${when}`,
  /** How often, in words: "every day at 08:30", "twice a day: 08:30 and 18:00", "Mondays at 09:00". */
  when: (times: readonly string[], weekdays: readonly string[]): string => {
    if (times.length === 0) return "No time set"
    const at = times.length === 1 ? `at ${times[0]}` : `at ${list(times, "and")}`
    const days = ordered(weekdays)
    if (days.length === 0 || days.length === 7)
      return times.length === 1
        ? `Every day ${at}`
        : times.length === 2
          ? `Twice a day: ${list(times, "and")}`
          : `${times.length} times a day: ${list(times, "and")}`
    const named = same(days, WORKWEEK)
      ? "Weekdays"
      : same(days, WEEKEND)
        ? "Weekends"
        : list(
            days.map((d) => en.weekdaysPlural[d as Weekday]),
            "and",
          )
    return `${named} ${at}`
  },
  weekdaysPlural: {
    mon: "Mondays",
    tue: "Tuesdays",
    wed: "Wednesdays",
    thu: "Thursdays",
    fri: "Fridays",
    sat: "Saturdays",
    sun: "Sundays",
  } satisfies Record<Weekday, string>,
  allSources: "All sources",
  sources: {
    telegram: "Telegram",
    max: "MAX",
    whatsapp: "WhatsApp",
    mail: "Mail",
    meetings: "Meetings",
    tasks: "Tasks",
  } satisfies Record<Source, string>,
  onlyHere: "Only here",
  never: "Not yet",
  lastFailed: "failed",
  notScheduled: "Off schedule",
  scheduleSwitch: (title: string) => `${title} on schedule`,
  running: "Writing…",
  open: (title: string) => `Open ${title}`,
  starter: {
    title: "No digests yet",
    more: "New digest",
    restsBadge: "Off schedule",
    morningRests: "Your morning digest is off its schedule; its past days are kept. Set up brings it back.",
    body: "Start from a template; you can change everything later.",
    daily: "Daily digest",
    dailyBody: "Every morning, what came in and what waits for you.",
    weekly: "Weekly digest",
    weeklyBody: "Monday morning, the week on one page.",
    own: "Create your own",
    ownBody: "Your own times, days, sources and instructions.",
    setUp: "Set up",
    needsUpdate: "Needs a Memo update",
  },
  form: {
    createTitle: "Create digest",
    title: "Title",
    times: "Times",
    timesHint: "One run at each time. Two times give a morning and an evening digest.",
    addTime: "Add a time",
    removeTime: (time: string) => `Remove ${time}`,
    days: "Days",
    everyDay: "Every day",
    onDays: "On days",
    pickDay: "Pick at least one day.",
    needTitle: "Enter a title.",
    needTime: "Set each time as HH:MM.",
    nothingToSave: "Nothing is changed yet.",
    sources: "Takes from",
    sourcesHint: "With none picked, every connected source.",
    allConnected: "All connected sources",
    sourceList: "Sources",
    brief: "Instructions",
    briefHint: "What to collect and what to skip, in your own words. Optional.",
    briefPlaceholder: "For example: projects HRB and the warehouse first; skip newsletters.",
    caps: "Cost limits",
    perRun: "A run, at most",
    perDay: "A day, at most",
    perDayHint: "0 is no daily limit.",
    schedule: "Run it on schedule",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    create: "Create",
    creating: "Creating…",
    needsUpdate: "Needs a Memo update",
    olderMemo: "More than one time a day, weekdays, sources and a title come with a Memo update.",
    noHarness: "Digests are written by Claude Code, which is not installed.",
    toAgents: "Install it in Agents",
    saved: "Saved.",
    failedCreate: "Not created.",
    failedSave: "Not saved.",
  },
  one: {
    back: "All digests",
    settings: "Settings",
    latest: "Latest",
    getNow: "Get now",
    getNowHint: "Writes it now and sends it where the schedule sends it.",
    getNowMenu: "Other ways to get it now",
    onlyHere: "Only show here",
    onlyTo: (route: string) => `Send only to ${route}`,
    putOn: "Put on schedule",
    takeOff: "Take off schedule",
    remove: "Remove digest",
    removeTitle: (title: string) => `Remove “${title}”?`,
    removeBody: "Its settings and schedule go. The past days it wrote stay readable.",
    removeConfirm: "Remove",
    more: "More",
    confirmTitle: "Get the digest now?",
    confirmPrice: (price: string | null) =>
      price ? `It costs about ${price}, as the last run did.` : "There is no price from an earlier run yet.",
    confirmAll: (to: string) => `It is sent ${to}, as a scheduled run is, and shows here.`,
    confirmHere: "It only shows here; nothing is sent.",
    confirmOnly: (to: string) => `It is sent ${to} only, and shows here.`,
    to: (routes: string) => (routes ? `to ${routes}` : "nowhere but here"),
    run: (price: string | null) => (price ? `Get it for about ${price}` : "Get it"),
    running: "Writing the digest… this takes a few minutes. You can leave this page.",
    failedRun: (message: string) => `Could not write it: ${message}`,
    failedSchedule: (message: string) => `Could not change the schedule: ${message}`,
    failedRemove: (message: string) => `Not removed: ${message}`,
    spentToday: (usd: string, cap: string | null) => `Spent today: ${usd}${cap ? ` of ${cap}` : ""}`,
    nextRun: (when: string) => `Next run ${when}`,
  },
}

const ruPlural = {
  mon: "понедельникам",
  tue: "вторникам",
  wed: "средам",
  thu: "четвергам",
  fri: "пятницам",
  sat: "субботам",
  sun: "воскресеньям",
} satisfies Record<Weekday, string>

const ru: typeof en = {
  create: "Создать сводку",
  table: "Сводки",
  col: {
    name: "Название",
    when: "Как часто",
    sources: "Откуда берёт",
    routes: "Куда шлёт",
    last: "Запуск",
    scheduled: "В расписании",
  },
  morning: "Утренняя сводка",
  nextAt: (when) => `Далее: ${when}`,
  when: (times, weekdays) => {
    if (times.length === 0) return "Время не задано"
    const at = `в ${list(times, "и")}`
    const days = ordered(weekdays)
    if (days.length === 0 || days.length === 7)
      return times.length === 1
        ? `Каждый день ${at}`
        : times.length === 2
          ? `Дважды в день: ${list(times, "и")}`
          : `${plural("ru", times.length, { one: "# раз", few: "# раза", many: "# раз", other: "# раза" })} в день: ${list(times, "и")}`
    const named = same(days, WORKWEEK)
      ? "По будням"
      : same(days, WEEKEND)
        ? "По выходным"
        : `По ${list(
            days.map((d) => ruPlural[d as Weekday]),
            "и",
          )}`
    return `${named} ${at}`
  },
  weekdaysPlural: ruPlural,
  allSources: "Все источники",
  sources: {
    telegram: "Telegram",
    max: "MAX",
    whatsapp: "WhatsApp",
    mail: "Почта",
    meetings: "Встречи",
    tasks: "Задачи",
  },
  onlyHere: "Только здесь",
  never: "Ещё не было",
  lastFailed: "не удался",
  notScheduled: "Не в расписании",
  scheduleSwitch: (title) => `${title} в расписании`,
  running: "Пишу…",
  open: (title) => `Открыть: ${title}`,
  starter: {
    title: "Сводок пока нет",
    more: "Новая сводка",
    restsBadge: "Снята с расписания",
    morningRests: "Утренняя сводка снята с расписания, её прошлые дни сохранены. «Настроить» вернёт её.",
    body: "Начните с шаблона, всё можно поменять потом.",
    daily: "Ежедневная сводка",
    dailyBody: "Каждое утро: что пришло и что ждёт вашего ответа.",
    weekly: "Еженедельная сводка",
    weeklyBody: "В понедельник утром: вся неделя на одной странице.",
    own: "Создать свою",
    ownBody: "Своё время, дни, источники и указания.",
    setUp: "Настроить",
    needsUpdate: "Нужно обновить Memo",
  },
  form: {
    createTitle: "Создать сводку",
    title: "Название",
    times: "Время",
    timesHint: "Запуск в каждое указанное время. Два времени — утренняя и вечерняя сводка.",
    addTime: "Добавить время",
    removeTime: (time) => `Убрать ${time}`,
    days: "Дни",
    everyDay: "Каждый день",
    onDays: "По дням",
    pickDay: "Выберите хотя бы один день.",
    needTitle: "Введите название.",
    needTime: "Укажите каждое время в виде ЧЧ:ММ.",
    nothingToSave: "Пока ничего не изменено.",
    sources: "Откуда берет",
    sourcesHint: "Если ничего не выбрано, берет из всех подключенных источников.",
    allConnected: "Все подключенные источники",
    sourceList: "Источники",
    brief: "Указания",
    briefHint: "Что собирать и что пропускать, своими словами. Необязательно.",
    briefPlaceholder: "Например: сначала проекты HRB и склад; рассылки пропускать.",
    caps: "Лимиты расходов",
    perRun: "За запуск, не больше",
    perDay: "За день, не больше",
    perDayHint: "0 — без дневного лимита.",
    schedule: "Запускать по расписанию",
    save: "Сохранить",
    saving: "Сохраняю…",
    cancel: "Отмена",
    create: "Создать",
    creating: "Создаю…",
    needsUpdate: "Нужно обновить Memo",
    olderMemo: "Несколько запусков в день, дни недели, источники и название появятся после обновления Memo.",
    noHarness: "Сводки пишет Claude Code, а он не установлен.",
    toAgents: "Установить в «Агентах»",
    saved: "Сохранено.",
    failedCreate: "Не создано.",
    failedSave: "Не сохранено.",
  },
  one: {
    back: "Все сводки",
    settings: "Настройки",
    latest: "Последняя",
    getNow: "Получить сейчас",
    getNowHint: "Пишет сводку сейчас и отправляет туда же, куда расписание.",
    getNowMenu: "Другие способы получить сейчас",
    onlyHere: "Только показать здесь",
    onlyTo: (route) => `Отправить только: ${route}`,
    putOn: "Поставить в расписание",
    takeOff: "Снять с расписания",
    remove: "Удалить сводку",
    removeTitle: (title) => `Удалить «${title}»?`,
    removeBody: "Уйдут её настройки и расписание. Прошлые дни останутся, их можно читать.",
    removeConfirm: "Удалить",
    more: "Ещё",
    confirmTitle: "Получить сводку сейчас?",
    confirmPrice: (price) =>
      price ? `Это стоит около ${price}, как прошлый запуск.` : "Цены прошлого запуска пока нет.",
    confirmAll: (to) => `Сводка уйдёт ${to}, как при запуске по расписанию, и появится здесь.`,
    confirmHere: "Сводка появится только здесь, никуда не отправится.",
    confirmOnly: (to) => `Сводка уйдёт только ${to} и появится здесь.`,
    to: (routes) => (routes ? `в ${routes}` : "никуда, кроме этой страницы"),
    run: (price) => (price ? `Получить примерно за ${price}` : "Получить"),
    running: "Пишу сводку… это займёт несколько минут. Страницу можно закрыть.",
    failedRun: (message) => `Не удалось написать сводку: ${message}`,
    failedSchedule: (message) => `Не удалось изменить расписание: ${message}`,
    failedRemove: (message) => `Не удалено: ${message}`,
    spentToday: (usd, cap) => `Потрачено сегодня: ${usd}${cap ? ` из ${cap}` : ""}`,
    nextRun: (when) => `Следующий запуск ${when}`,
  },
}

const esPlural = {
  mon: "lunes",
  tue: "martes",
  wed: "miércoles",
  thu: "jueves",
  fri: "viernes",
  sat: "sábados",
  sun: "domingos",
} satisfies Record<Weekday, string>

const es: typeof en = {
  create: "Crear resumen",
  table: "Resúmenes",
  col: {
    name: "Nombre",
    when: "Con qué frecuencia",
    sources: "De dónde toma",
    routes: "Adónde envía",
    last: "Ejecución",
    scheduled: "Programado",
  },
  morning: "Resumen matutino",
  nextAt: (when) => `Siguiente: ${when}`,
  when: (times, weekdays) => {
    if (times.length === 0) return "Sin hora"
    const at = `a las ${list(times, "y")}`
    const days = ordered(weekdays)
    if (days.length === 0 || days.length === 7)
      return times.length === 1
        ? `Cada día ${at}`
        : times.length === 2
          ? `Dos veces al día: ${list(times, "y")}`
          : `${times.length} veces al día: ${list(times, "y")}`
    const named = same(days, WORKWEEK)
      ? "Entre semana"
      : same(days, WEEKEND)
        ? "Los fines de semana"
        : `Los ${list(
            days.map((d) => esPlural[d as Weekday]),
            "y",
          )}`
    return `${named} ${at}`
  },
  weekdaysPlural: esPlural,
  allSources: "Todas las fuentes",
  sources: {
    telegram: "Telegram",
    max: "MAX",
    whatsapp: "WhatsApp",
    mail: "Correo",
    meetings: "Reuniones",
    tasks: "Tareas",
  },
  onlyHere: "Solo aquí",
  never: "Aún no",
  lastFailed: "falló",
  notScheduled: "Sin programar",
  scheduleSwitch: (title) => `${title} programado`,
  running: "Escribiendo…",
  open: (title) => `Abrir ${title}`,
  starter: {
    title: "Aún no hay resúmenes",
    more: "Nuevo resumen",
    restsBadge: "Fuera de horario",
    morningRests:
      "Tu resumen matutino está fuera de su horario; sus días anteriores se conservan. «Configurar» lo recupera.",
    body: "Empieza con una plantilla; todo se puede cambiar después.",
    daily: "Resumen diario",
    dailyBody: "Cada mañana: lo que llegó y lo que espera tu respuesta.",
    weekly: "Resumen semanal",
    weeklyBody: "El lunes por la mañana: la semana en una página.",
    own: "Crear el tuyo",
    ownBody: "Tus horas, días, fuentes e instrucciones.",
    setUp: "Configurar",
    needsUpdate: "Hay que actualizar Memo",
  },
  form: {
    createTitle: "Crear resumen",
    title: "Nombre",
    times: "Horas",
    timesHint: "Una ejecución a cada hora. Dos horas dan un resumen de mañana y otro de tarde.",
    addTime: "Añadir una hora",
    removeTime: (time) => `Quitar ${time}`,
    days: "Días",
    everyDay: "Cada día",
    onDays: "Algunos días",
    pickDay: "Elige al menos un día.",
    needTitle: "Escribe un título.",
    needTime: "Indica cada hora como HH:MM.",
    nothingToSave: "Aún no has cambiado nada.",
    sources: "De dónde toma",
    sourcesHint: "Sin ninguna elegida, todas las fuentes conectadas.",
    allConnected: "Todas las fuentes conectadas",
    sourceList: "Fuentes",
    brief: "Instrucciones",
    briefHint: "Qué recoger y qué omitir, con tus palabras. Opcional.",
    briefPlaceholder: "Por ejemplo: primero los proyectos HRB y el almacén; omite los boletines.",
    caps: "Límites de gasto",
    perRun: "Por ejecución, como mucho",
    perDay: "Por día, como mucho",
    perDayHint: "0 es sin límite diario.",
    schedule: "Ejecutar según el horario",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    create: "Crear",
    creating: "Creando…",
    needsUpdate: "Hay que actualizar Memo",
    olderMemo: "Varias horas al día, días de la semana, fuentes y nombre llegan con una actualización de Memo.",
    noHarness: "Los resúmenes los escribe Claude Code, que no está instalado.",
    toAgents: "Instalarlo en Agentes",
    saved: "Guardado.",
    failedCreate: "No se creó.",
    failedSave: "No se guardó.",
  },
  one: {
    back: "Todos los resúmenes",
    settings: "Ajustes",
    latest: "El último",
    getNow: "Obtener ahora",
    getNowHint: "Lo escribe ahora y lo envía adonde lo envía el horario.",
    getNowMenu: "Otras formas de obtenerlo ahora",
    onlyHere: "Solo mostrar aquí",
    onlyTo: (route) => `Enviar solo a ${route}`,
    putOn: "Programar",
    takeOff: "Quitar de la programación",
    remove: "Eliminar resumen",
    removeTitle: (title) => `¿Eliminar «${title}»?`,
    removeBody: "Se van sus ajustes y su horario. Los días pasados que escribió se siguen pudiendo leer.",
    removeConfirm: "Eliminar",
    more: "Más",
    confirmTitle: "¿Obtener el resumen ahora?",
    confirmPrice: (price) =>
      price ? `Cuesta unos ${price}, como la última ejecución.` : "Aún no hay precio de una ejecución anterior.",
    confirmAll: (to) => `Se envía ${to}, como una ejecución programada, y aparece aquí.`,
    confirmHere: "Solo aparece aquí; no se envía nada.",
    confirmOnly: (to) => `Se envía solo ${to} y aparece aquí.`,
    to: (routes) => (routes ? `a ${routes}` : "a ningún sitio salvo aquí"),
    run: (price) => (price ? `Obtenerlo por unos ${price}` : "Obtenerlo"),
    running: "Escribiendo el resumen… tarda unos minutos. Puedes salir de esta página.",
    failedRun: (message) => `No se pudo escribir: ${message}`,
    failedSchedule: (message) => `No se pudo cambiar el horario: ${message}`,
    failedRemove: (message) => `No se eliminó: ${message}`,
    spentToday: (usd, cap) => `Gastado hoy: ${usd}${cap ? ` de ${cap}` : ""}`,
    nextRun: (when) => `Próxima ejecución ${when}`,
  },
}

export type BookText = typeof en
export const bookMessages: Messages<typeof en> = { en, ru, es }
