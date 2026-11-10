import { type Messages, plural } from "@/i18n"

type RouteKind = "telegramBot" | "email"

/** Minutes as the largest whole unit: 1440 is one day, 120 two hours. */
const unitOf = (minutes: number): ["day" | "hour" | "minute", number] =>
  minutes % 1440 === 0 ? ["day", minutes / 1440] : minutes % 60 === 0 ? ["hour", minutes / 60] : ["minute", minutes]

const en = {
  title: "Morning digest schedule",
  readFailed: (message: string) => `Could not read the schedules: ${message}`,
  toggle: "Write the digest every morning",
  daily: (time: string) => `Every day at ${time}`,
  when: (when: string) => `Runs ${when}`,
  routes: "Sends it to",
  routeKinds: { telegramBot: "Telegram bot", email: "Mail" } satisfies Record<RouteKind, string>,
  noRoute: "only this computer's notification",
  ok: "finished",
  failed: (times: number | null) => (times && times > 1 ? `failed ${times} times in a row` : "failed"),
  cost: (usd: string) => `cost ${usd}`,
  notDelivered: (kind: string) => `not delivered to ${kind}`,
  noRunYet: "No run yet.",
  capReached: "Today's limit is reached: no more digests are written today.",
  time: "Time",
  changeTime: "Change the time",
  runNow: "Run now…",
  running: "Writing the digest… this takes a few minutes.",
  saving: "Saving…",
  removing: "Turning off…",
  offBody: "Each morning at this time you get the digest where you choose. Turning it off keeps every past digest.",
  turnOn: "Turn on",
  create: "Schedule the digest",
  noHarness: "Claude Code is not installed. The digest is written in it: install Claude Code first.",
  routesHint: "Where to send it. With none, it only shows here and as a notification.",
  addRoute: "Add",
  routeProfile: "Account",
  routeTo: (kind: RouteKind): string => (kind === "email" ? "Address" : "Chat id or user:id"),
  routeIncomplete: (kind: RouteKind): string =>
    kind === "email" ? "Choose an account and type an address first." : "Choose an account and type a chat id first.",
  removeRoute: (route: string) => `Remove ${route}`,
  caps: (run: string, day: string) => `At most ${run} a run and ${day} a day.`,
  failedSave: (message: string) => `Could not save the schedule: ${message}`,
  failedRemove: (message: string) => `Could not turn the schedule off: ${message}`,
  failedRun: (message: string) => `Could not run the digest: ${message}`,
  confirmTitle: "Run the morning digest now?",
  confirmBody: (price: string | null, to: string) =>
    `${price ? `It costs about ${price}, as the last run did.` : "There is no price from an earlier run yet."} It is sent ${to}, as the morning run is.`,
  confirmTo: (routes: string) => (routes ? `to ${routes}` : "to this computer's notification only"),
  confirmRun: (price: string | null) => (price ? `Run for about ${price}` : "Run"),
  cancel: "Cancel",
  others: "Other schedules",
  othersHint: "Other jobs memo runs on a schedule. They are shown here only; each is changed where it was set up.",
  changeMailAgent: (tool: string) => `Change in Tools → ${tool} → Mail agent`,
  othersCol: { name: "Name", when: "How often", last: "Last run", spent: "Spent today", change: "Changed in" },
  every: (minutes: number) => {
    const [unit, n] = unitOf(minutes)
    return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`
  },
  once: (at: string) => `Once, ${at}`,
  capOf: (cap: string) => `of ${cap} a day`,
  mailAgentAt: (tool: string) => `Tools → ${tool} → Mail agent`,
  inTerminal: "In a terminal: memo schedule",
  ownChat: (profile: string) => `you, in ${profile}`,
  ownMailbox: (profile: string) => `mailbox ${profile}`,
  otherLine: (when: string) => when,
  skippedWhy: (why: string) => `skipped: ${why}`,
  skipReasons: {
    "cost.day-cap": "the daily cost limit is reached",
    "mail.none-new": "no new mail",
    "mail.below-threshold": "not enough new mail yet",
  } as Record<string, string>,
  history: {
    fill: "Build past days…",
    needsUpdate: "Needs a Memo update",
    needsUpdateHint: "This Memo cannot build past digests yet. Update Memo to fill the history.",
    builtLater: "built later",
    title: "Build the digests of past days",
    body: "You get the digest each past day would have had, to read and compare in this list. They are not sent to Telegram or mail, so your chats do not fill with old news.",
    days: "How many days",
    span: (n: number) => plural("en", n, { one: "# day", other: "# days" }),
    pricing: "Working out the price…",
    estimate: (days: number, skipped: number, price: string | null) =>
      days === 0
        ? "Every one of these days already has a digest."
        : `${plural("en", days, { one: "# day", other: "# days" })} to build${skipped > 0 ? ` (${skipped} already have one)` : ""}${price ? `, about ${price}` : ""}.`,
    priceNote: "The price is the last run's cost for each day.",
    build: (price: string | null) => (price ? `Build for about ${price}` : "Build"),
    building: (days: number) =>
      `Building ${plural("en", days, { one: "# day", other: "# days" })}… each takes a minute or two. You can close this; it keeps going.`,
    done: (built: number, cost: string | null) =>
      `Built ${plural("en", built, { one: "# day", other: "# days" })}${cost ? ` for ${cost}` : ""}. They are in the list, marked “built later”.`,
    failed: (message: string) => `The build stopped: ${message}. The days built before it stopped are kept.`,
    priceFailed: (message: string) => `Could not get the price: ${message}`,
    unsupported: "This Memo cannot build past digests yet. Update Memo, then try again.",
    close: "Close",
    back: "Back",
  },
}

const ru: typeof en = {
  title: "Расписание утренней сводки",
  readFailed: (message) => `Не удалось прочитать расписания: ${message}`,
  toggle: "Писать сводку каждое утро",
  daily: (time) => `Каждый день в ${time}`,
  when: (when) => `Запуск: ${when}`,
  routes: "Отправляет",
  routeKinds: { telegramBot: "Telegram-бот", email: "Почта" },
  noRoute: "только уведомление на этом компьютере",
  ok: "прошёл успешно",
  failed: (times) =>
    times && times > 1
      ? plural("ru", times, {
          one: "не удался # раз подряд",
          few: "не удался # раза подряд",
          many: "не удался # раз подряд",
          other: "не удался # раза подряд",
        })
      : "не удался",
  cost: (usd) => `стоил ${usd}`,
  notDelivered: (kind) => `не доставлено: ${kind}`,
  noRunYet: "Запусков ещё не было.",
  capReached: "Дневной лимит исчерпан: сегодня сводок больше не будет.",
  time: "Время",
  changeTime: "Изменить время",
  runNow: "Запустить сейчас…",
  running: "Пишу сводку… это займёт несколько минут.",
  saving: "Сохраняю…",
  removing: "Выключаю…",
  offBody:
    "Каждое утро в это время вы получаете сводку туда, куда выберете. Если выключить, все прошлые сводки останутся.",
  turnOn: "Включить",
  create: "Поставить сводку в расписание",
  noHarness: "Claude Code не установлен. Сводка пишется в нём: сначала установите Claude Code.",
  routesHint: "Куда отправлять. Если никуда, сводка будет только здесь и в уведомлении.",
  addRoute: "Добавить",
  routeProfile: "Аккаунт",
  routeTo: (kind) => (kind === "email" ? "Адрес" : "Id чата или user:id"),
  routeIncomplete: (kind) =>
    kind === "email" ? "Сначала выберите аккаунт и введите адрес." : "Сначала выберите аккаунт и введите id чата.",
  removeRoute: (route) => `Убрать ${route}`,
  caps: (run, day) => `Не больше ${run} за запуск и ${day} в день.`,
  failedSave: (message) => `Не удалось сохранить расписание: ${message}`,
  failedRemove: (message) => `Не удалось выключить расписание: ${message}`,
  failedRun: (message) => `Не удалось запустить сводку: ${message}`,
  confirmTitle: "Запустить утреннюю сводку сейчас?",
  confirmBody: (price, to) =>
    `${price ? `Это стоит около ${price}, как прошлый запуск.` : "Цены прошлого запуска пока нет."} Сводка уйдёт ${to}, как и утренняя.`,
  confirmTo: (routes) => (routes ? `в ${routes}` : "только в уведомление на этом компьютере"),
  confirmRun: (price) => (price ? `Запустить примерно за ${price}` : "Запустить"),
  cancel: "Отмена",
  others: "Другие расписания",
  othersHint:
    "Другие задания, которые memo запускает по расписанию. Здесь они только видны, а меняются там, где их настроили.",
  changeMailAgent: (tool) => `Изменить: Инструменты → ${tool} → Почтовый агент`,
  othersCol: {
    name: "Название",
    when: "Как часто",
    last: "Последний запуск",
    spent: "Потрачено сегодня",
    change: "Где меняется",
  },
  every: (minutes) => {
    const [unit, n] = unitOf(minutes)
    const forms = {
      day: { one: "# день", few: "# дня", many: "# дней", other: "# дня" },
      hour: { one: "# час", few: "# часа", many: "# часов", other: "# часа" },
      minute: { one: "# минуту", few: "# минуты", many: "# минут", other: "# минуты" },
    }[unit]
    return n === 1 ? `Раз в ${forms.one.slice(2)}` : `Раз в ${plural("ru", n, forms)}`
  },
  once: (at) => `Один раз, ${at}`,
  capOf: (cap) => `из ${cap} в день`,
  mailAgentAt: (tool) => `Инструменты → ${tool} → Почтовый агент`,
  inTerminal: "В терминале: memo schedule",
  ownChat: (profile) => `вы, в профиле ${profile}`,
  ownMailbox: (profile) => `ящик ${profile}`,
  otherLine: (when) => when,
  skippedWhy: (why) => `пропущен: ${why}`,
  skipReasons: {
    "cost.day-cap": "дневной лимит расходов исчерпан",
    "mail.none-new": "новой почты нет",
    "mail.below-threshold": "новой почты пока мало",
  },
  history: {
    fill: "Собрать прошлые дни…",
    needsUpdate: "Нужно обновить Memo",
    needsUpdateHint: "Эта версия Memo пока не умеет собирать прошлые сводки. Обновите Memo, чтобы заполнить историю.",
    builtLater: "собрана позже",
    title: "Собрать сводки за прошлые дни",
    body: "Вы получите сводку, какой она была бы в каждый прошлый день, чтобы прочитать и сравнить их в этом списке. В Telegram и почту они не уходят, чтобы старые новости не засыпали ваши чаты.",
    days: "За сколько дней",
    span: (n) => plural("ru", n, { one: "# день", few: "# дня", many: "# дней", other: "# дня" }),
    pricing: "Считаю цену…",
    estimate: (days, skipped, price) =>
      days === 0
        ? "У всех этих дней сводка уже есть."
        : `Собрать ${plural("ru", days, { one: "# день", few: "# дня", many: "# дней", other: "# дня" })}${skipped > 0 ? ` (у ${skipped} уже есть)` : ""}${price ? `, около ${price}` : ""}.`,
    priceNote: "Цена — стоимость прошлого запуска за каждый день.",
    build: (price) => (price ? `Собрать примерно за ${price}` : "Собрать"),
    building: (days) =>
      `Собираю ${plural("ru", days, { one: "# день", few: "# дня", many: "# дней", other: "# дня" })}… на каждый уходит минута-две. Окно можно закрыть, сборка продолжится.`,
    done: (built, cost) =>
      `Собрано: ${plural("ru", built, { one: "# день", few: "# дня", many: "# дней", other: "# дня" })}${cost ? ` за ${cost}` : ""}. Они в списке с пометкой «собрана позже».`,
    failed: (message) => `Сборка остановилась: ${message}. Дни, собранные до остановки, сохранены.`,
    priceFailed: (message) => `Не удалось узнать цену: ${message}`,
    unsupported: "Эта версия Memo пока не умеет собирать прошлые сводки. Обновите Memo и попробуйте снова.",
    close: "Закрыть",
    back: "Назад",
  },
}

const es: typeof en = {
  title: "Horario del resumen matutino",
  readFailed: (message) => `No se pudieron leer los horarios: ${message}`,
  toggle: "Escribir el resumen cada mañana",
  daily: (time) => `Cada día a las ${time}`,
  when: (when) => `Se ejecuta: ${when}`,
  routes: "Lo envía a",
  routeKinds: { telegramBot: "Bot de Telegram", email: "Correo" },
  noRoute: "solo la notificación de este ordenador",
  ok: "terminó bien",
  failed: (times) => (times && times > 1 ? `falló ${times} veces seguidas` : "falló"),
  cost: (usd) => `costó ${usd}`,
  notDelivered: (kind) => `no entregado: ${kind}`,
  noRunYet: "Aún no se ha ejecutado.",
  capReached: "Se alcanzó el límite de hoy: hoy no se escriben más resúmenes.",
  time: "Hora",
  changeTime: "Cambiar la hora",
  runNow: "Ejecutar ahora…",
  running: "Escribiendo el resumen… tarda unos minutos.",
  saving: "Guardando…",
  removing: "Desactivando…",
  offBody:
    "Cada mañana a esta hora recibes el resumen donde elijas. Al desactivarlo se conservan todos los resúmenes anteriores.",
  turnOn: "Activar",
  create: "Programar el resumen",
  noHarness: "Claude Code no está instalado. El resumen se escribe en él: instala Claude Code primero.",
  routesHint: "Dónde enviarlo. Sin ninguno, solo aparece aquí y como notificación.",
  addRoute: "Añadir",
  routeProfile: "Cuenta",
  routeTo: (kind) => (kind === "email" ? "Dirección" : "Id del chat o user:id"),
  routeIncomplete: (kind) =>
    kind === "email"
      ? "Primero elige una cuenta y escribe una dirección."
      : "Primero elige una cuenta y escribe un id de chat.",
  removeRoute: (route) => `Quitar ${route}`,
  caps: (run, day) => `Como mucho ${run} por ejecución y ${day} al día.`,
  failedSave: (message) => `No se pudo guardar el horario: ${message}`,
  failedRemove: (message) => `No se pudo desactivar el horario: ${message}`,
  failedRun: (message) => `No se pudo ejecutar el resumen: ${message}`,
  confirmTitle: "¿Ejecutar el resumen matutino ahora?",
  confirmBody: (price, to) =>
    `${price ? `Cuesta unos ${price}, como la última ejecución.` : "Aún no hay precio de una ejecución anterior."} Se envía ${to}, como el de la mañana.`,
  confirmTo: (routes) => (routes ? `a ${routes}` : "solo a la notificación de este ordenador"),
  confirmRun: (price) => (price ? `Ejecutar por unos ${price}` : "Ejecutar"),
  cancel: "Cancelar",
  others: "Otros horarios",
  othersHint:
    "Otras tareas que memo ejecuta según un horario. Aquí solo se ven; cada una se cambia donde se configuró.",
  changeMailAgent: (tool) => `Cambiar en Herramientas → ${tool} → Agente de correo`,
  othersCol: {
    name: "Nombre",
    when: "Con qué frecuencia",
    last: "Última ejecución",
    spent: "Gastado hoy",
    change: "Dónde se cambia",
  },
  every: (minutes) => {
    const [unit, n] = unitOf(minutes)
    const word = { day: ["día", "días"], hour: ["hora", "horas"], minute: ["minuto", "minutos"] }[unit]
    return n === 1 ? `Cada ${word[0]}` : `Cada ${n} ${word[1]}`
  },
  once: (at) => `Una vez, ${at}`,
  capOf: (cap) => `de ${cap} al día`,
  mailAgentAt: (tool) => `Herramientas → ${tool} → Agente de correo`,
  inTerminal: "En una terminal: memo schedule",
  ownChat: (profile) => `tú, en ${profile}`,
  ownMailbox: (profile) => `buzón ${profile}`,
  otherLine: (when) => when,
  skippedWhy: (why) => `omitida: ${why}`,
  skipReasons: {
    "cost.day-cap": "se alcanzó el límite diario de gasto",
    "mail.none-new": "no hay correo nuevo",
    "mail.below-threshold": "aún hay poco correo nuevo",
  },
  history: {
    fill: "Crear días pasados…",
    needsUpdate: "Hay que actualizar Memo",
    needsUpdateHint: "Esta versión de Memo aún no crea resúmenes pasados. Actualiza Memo para completar el historial.",
    builtLater: "creado después",
    title: "Crear los resúmenes de días pasados",
    body: "Recibes el resumen que habría tenido cada día pasado, para leerlos y compararlos en esta lista. No se envían a Telegram ni al correo, para que tus chats no se llenen de noticias viejas.",
    days: "Cuántos días",
    span: (n) => plural("es", n, { one: "# día", other: "# días" }),
    pricing: "Calculando el precio…",
    estimate: (days, skipped, price) =>
      days === 0
        ? "Todos estos días ya tienen resumen."
        : `${plural("es", days, { one: "# día", other: "# días" })} por crear${skipped > 0 ? ` (${skipped} ya lo tienen)` : ""}${price ? `, unos ${price}` : ""}.`,
    priceNote: "El precio es el coste de la última ejecución por cada día.",
    build: (price) => (price ? `Crear por unos ${price}` : "Crear"),
    building: (days) =>
      `Creando ${plural("es", days, { one: "# día", other: "# días" })}… cada uno tarda un minuto o dos. Puedes cerrar esto; sigue en marcha.`,
    done: (built, cost) =>
      `Creados ${plural("es", built, { one: "# día", other: "# días" })}${cost ? ` por ${cost}` : ""}. Están en la lista, marcados “creado después”.`,
    failed: (message) => `La creación se detuvo: ${message}. Se conservan los días creados antes.`,
    priceFailed: (message) => `No se pudo obtener el precio: ${message}`,
    unsupported: "Esta versión de Memo aún no crea resúmenes pasados. Actualiza Memo y vuelve a intentarlo.",
    close: "Cerrar",
    back: "Atrás",
  },
}

export type ScheduleText = typeof en
export const scheduleMessages: Messages<typeof en> = { en, ru, es }
