import type { AdviceKind, SyncProgress, SyncSummary, SyncWhat } from "@/domain/sync"
import { formatDate, formatNumber, type Messages, plural } from "@/i18n"

/** The wait a service asked for: whole minutes, and the time after which the next sync may start. */
type SlowDown = { minutes: number; at: number } | null
const clockOf = (at: number, lang: "en" | "ru" | "es") => formatDate(at, { hour: "numeric", minute: "2-digit" }, lang)

const EN_WHAT: Record<SyncWhat, { one: string; other: string; place: [string, string]; noun: string }> = {
  messages: { one: "new message", other: "new messages", place: ["chat", "chats"], noun: "messages" },
  files: { one: "file", other: "files", place: ["folder", "folders"], noun: "files" },
  meetings: { one: "meeting", other: "meetings", place: ["meeting", "meetings"], noun: "meetings" },
  "notes and mail": {
    one: "new email or note",
    other: "new emails and notes",
    place: ["source", "sources"],
    noun: "notes and mail",
  },
  mail: { one: "new email", other: "new emails", place: ["account", "accounts"], noun: "mail" },
  records: { one: "new record", other: "new records", place: ["source", "sources"], noun: "records" },
}
const enCount = (n: number, [one, other]: [string, string]) => plural("en", n, { one: `# ${one}`, other: `# ${other}` })
const enNew = (what: SyncWhat, n: number) => enCount(n, [EN_WHAT[what].one, EN_WHAT[what].other])
type RuForms = { one: string; few: string; many: string }
const ru3 = (n: number, f: RuForms) => plural("ru", n, { ...f, other: f.few })
const RU_WHAT: Record<
  SyncWhat,
  { new: RuForms; place: RuForms; from: [string, string]; noun: RuForms; none: string; failed: string }
> = {
  messages: {
    new: { one: "# новое сообщение", few: "# новых сообщения", many: "# новых сообщений" },
    place: { one: "# чат", few: "# чата", many: "# чатов" },
    from: ["чата", "чатов"],
    noun: { one: "# сообщение", few: "# сообщения", many: "# сообщений" },
    none: "новых сообщений нет",
    failed: "Не удалось прочитать",
  },
  files: {
    new: { one: "# файл", few: "# файла", many: "# файлов" },
    place: { one: "# папка", few: "# папки", many: "# папок" },
    from: ["папки", "папок"],
    noun: { one: "# файл", few: "# файла", many: "# файлов" },
    none: "новых файлов нет",
    failed: "Не удалось прочитать",
  },
  meetings: {
    new: { one: "# встреча", few: "# встречи", many: "# встреч" },
    place: { one: "# встреча", few: "# встречи", many: "# встреч" },
    from: ["встречи", "встреч"],
    noun: { one: "# встреча", few: "# встречи", many: "# встреч" },
    none: "новых встреч нет",
    failed: "С предупреждением",
  },
  "notes and mail": {
    new: { one: "# новое письмо или заметка", few: "# новых письма и заметки", many: "# новых писем и заметок" },
    place: { one: "# источник", few: "# источника", many: "# источников" },
    from: ["источника", "источников"],
    noun: { one: "# письмо или заметка", few: "# письма и заметки", many: "# писем и заметок" },
    none: "новых писем и заметок нет",
    failed: "Не удалось прочитать",
  },
  mail: {
    new: { one: "# новое письмо", few: "# новых письма", many: "# новых писем" },
    place: { one: "# аккаунт", few: "# аккаунта", many: "# аккаунтов" },
    from: ["аккаунта", "аккаунтов"],
    noun: { one: "# письмо", few: "# письма", many: "# писем" },
    none: "новых писем нет",
    failed: "Не удалось прочитать",
  },
  records: {
    new: { one: "# новая запись", few: "# новые записи", many: "# новых записей" },
    place: { one: "# источник", few: "# источника", many: "# источников" },
    from: ["источника", "источников"],
    noun: { one: "# запись", few: "# записи", many: "# записей" },
    none: "новых записей нет",
    failed: "Не удалось прочитать",
  },
}
const ruFrom = (n: number, [one, many]: [string, string]) =>
  plural("ru", n, { one: `# ${one}`, few: `# ${many}`, many: `# ${many}`, other: `# ${many}` })
const ES_WHAT: Record<
  SyncWhat,
  { one: string; other: string; place: [string, string]; noun: [string, string]; none: string }
> = {
  messages: {
    one: "mensaje nuevo",
    other: "mensajes nuevos",
    place: ["chat", "chats"],
    noun: ["mensaje", "mensajes"],
    none: "no hay mensajes nuevos",
  },
  files: {
    one: "archivo",
    other: "archivos",
    place: ["carpeta", "carpetas"],
    noun: ["archivo", "archivos"],
    none: "no hay archivos nuevos",
  },
  meetings: {
    one: "reunión",
    other: "reuniones",
    place: ["reunión", "reuniones"],
    noun: ["reunión", "reuniones"],
    none: "no hay reuniones nuevas",
  },
  "notes and mail": {
    one: "correo o nota nuevos",
    other: "correos y notas nuevos",
    place: ["fuente", "fuentes"],
    noun: ["correo o nota", "correos y notas"],
    none: "no hay correos ni notas nuevos",
  },
  mail: {
    one: "correo nuevo",
    other: "correos nuevos",
    place: ["cuenta", "cuentas"],
    noun: ["correo", "correos"],
    none: "no hay correos nuevos",
  },
  records: {
    one: "registro nuevo",
    other: "registros nuevos",
    place: ["fuente", "fuentes"],
    noun: ["registro", "registros"],
    none: "no hay registros nuevos",
  },
}
const esCount = (n: number, [one, other]: [string, string]) => plural("es", n, { one: `# ${one}`, other: `# ${other}` })
const esNew = (what: SyncWhat, n: number) => esCount(n, [ES_WHAT[what].one, ES_WHAT[what].other])

const en = {
  sync: {
    lastUnknown: "Last sync unknown: the tool does not say",
    lastSynced: (ago: string) => `Last synced ${ago}`,
    left: (what: SyncWhat, n: number) => `${formatNumber(n, "en")} ${EN_WHAT[what].noun} still to come`,
    notFinished: (left: string) => `Not finished: ${left}`,
    noneRecorded: "No sync recorded from this app yet",
    region: (name: string) => `Sync ${name}`,
    readingLast: "Reading the last sync",
    stop: "Stop",
    stopping: "Stopping…",
    syncNow: "Sync now",
    syncAgain: "Sync again",
    anotherRunning: "Another sync of this account is running. Wait for it to finish, then sync again.",
    stoppingKeeping: "Stopping, keeping what came in",
    starting: "Starting",
    syncing: "Syncing",
    stopped: "Stopped",
    stoppedNext: "What came in is kept. The next sync continues from there.",
    signIn: "Sign in",
    update: (name: string) => `Update ${name}`,
    openRun: "Open the run on Logs",
    details: "Details",
    slowDown: (service: string, wait: SlowDown) =>
      `Requests to ${service} are paused for now. What came in is kept. ${
        wait
          ? `Sync again after ${clockOf(wait.at, "en")}, in about ${plural("en", wait.minutes, { one: "# minute", other: "# minutes" })}.`
          : "Wait a few minutes before you sync again."
      } The sync continues from where it stopped. WireCat does not try again by itself.`,
    dismiss: "Dismiss",
    rowStopped: "Sync stopped; what came in is kept",
    rowFailed: (title: string) => `Sync: ${title}`,
    stopSyncing: (name: string) => `Stop syncing ${name}`,
    syncNamed: (name: string) => `Sync ${name} now`,
    stopTitle: "Stop the sync",
    result: (what: SyncWhat, s: SyncSummary) => {
      if (s.new === 0) return `Up to date: no ${EN_WHAT[what].other}`
      const where = s.places > 0 ? ` in ${enCount(s.places, EN_WHAT[what].place)}` : ""
      return `Synced ${enNew(what, s.new)}${where}`
    },
    next: (what: SyncWhat, s: SyncSummary) => {
      const parts: string[] = []
      if (s.failed > 0)
        parts.push(
          what === "meetings"
            ? `${enNew(what, s.failed)} came with a warning; the next sync tries again.`
            : `${enCount(s.failed, EN_WHAT[what].place)} could not be read; the next sync tries again.`,
        )
      if (s.left > 0) parts.push(`${enNew(what, s.left)} still to come: sync again to continue.`)
      else if (!s.complete && s.failed === 0) parts.push("There is more history: sync again to continue.")
      return parts.length > 0 ? parts.join(" ") : null
    },
    done: (what: SyncWhat): string =>
      what === "meetings" ? "Your agents can read their transcripts now." : "Your agents can search them now.",
    progress: (p: SyncProgress) => {
      const fetched = enNew("messages", p.fetched)
      if (!p.chats || p.chatsDone === null) return fetched
      return `Chat ${formatNumber(Math.min(p.chats, p.chatsDone + 1), "en")} of ${formatNumber(p.chats, "en")} · ${fetched}`
    },
    advice: {
      timeout: "Time limit reached",
      busy: "Another sync is running",
      update: "Update needed",
      signedOut: "Signed out",
      keyring: "Could not read the sign-in",
      rateLimited: "Sync is paused for now",
      unreachable: "The service could not be reached",
      refused: "The tool refused the command",
      failed: "The sync failed",
    } as Record<AdviceKind, string>,
    adviceText: (kind: AdviceKind, account: string, message: string, logs: boolean): string => {
      switch (kind) {
        case "timeout":
          return "What came in is kept. Sync again to continue from where it stopped."
        case "busy":
          return `Something else is syncing ${account} right now, or the tool is being updated. Sync again when it ends.`
        case "update":
          return "A newer WireCat tool changed the storage. Update this tool on the Tools page, then sync again."
        case "signedOut":
          return `Sign in to ${account} again, then sync.`
        case "keyring":
          return "The computer's password store was closed. Sync again in a minute."
        case "rateLimited":
          return "What came in is kept. Wait a while, then sync again."
        case "unreachable":
          return "Check the internet connection, then sync again."
        case "refused":
          return "The tool did not accept the sync command WireCat sent. It is likely older or newer than this app expects."
        case "failed":
          return `${message || "The sync ended without saying how."}${logs ? " Its run on the Logs page shows what happened." : ""}`
      }
    },
  },
}

const ru: typeof en = {
  sync: {
    lastUnknown: "Время последней синхронизации неизвестно: инструмент его не сообщает",
    lastSynced: (ago) => `Последняя синхронизация: ${ago}`,
    left: (what, n) => `ещё ${ru3(n, RU_WHAT[what].noun)}`,
    notFinished: (left) => `Не закончена: ${left}`,
    noneRecorded: "Из этого приложения синхронизаций ещё не было",
    region: (name) => `Синхронизация ${name}`,
    readingLast: "Читаем время последней синхронизации",
    stop: "Остановить",
    stopping: "Останавливаем…",
    syncNow: "Синхронизировать",
    syncAgain: "Ещё раз",
    anotherRunning: "Этот аккаунт уже синхронизируется. Дождитесь конца и запустите снова.",
    stoppingKeeping: "Останавливаем, полученное сохраняется",
    starting: "Запускаем",
    syncing: "Синхронизация",
    stopped: "Остановлено",
    stoppedNext: "Полученное сохранено. Следующая синхронизация продолжит с этого места.",
    signIn: "Войти",
    update: (name) => `Обновить ${name}`,
    openRun: "Открыть запуск в журнале",
    details: "Подробнее",
    slowDown: (service, wait) =>
      `Запросы к ${service} пока на паузе. Полученное сохранено. ${
        wait
          ? `Синхронизируйте снова после ${clockOf(wait.at, "ru")}, примерно через ${plural("ru", wait.minutes, { one: "# минуту", few: "# минуты", many: "# минут", other: "# минуты" })}.`
          : "Подождите несколько минут перед следующей синхронизацией."
      } Синхронизация продолжит с того места, где остановилась. Сам WireCat повторять не будет.`,
    dismiss: "Скрыть",
    rowStopped: "Синхронизация остановлена, полученное сохранено",
    rowFailed: (title) => `Синхронизация: ${title}`,
    stopSyncing: (name) => `Остановить синхронизацию ${name}`,
    syncNamed: (name) => `Синхронизировать ${name}`,
    stopTitle: "Остановить синхронизацию",
    result: (what, s) => {
      const w = RU_WHAT[what]
      if (s.new === 0) return `Всё актуально: ${w.none}`
      const where = s.places > 0 ? ` из ${ruFrom(s.places, w.from)}` : ""
      return `Получено: ${ru3(s.new, w.new)}${where}`
    },
    next: (what, s) => {
      const w = RU_WHAT[what]
      const parts: string[] = []
      if (s.failed > 0) {
        const items = what === "meetings" ? ru3(s.failed, w.new) : ru3(s.failed, w.place)
        parts.push(`${w.failed}: ${items}. Следующая синхронизация попробует снова.`)
      }
      if (s.left > 0) parts.push(`Осталось: ${ru3(s.left, w.new)}. Синхронизируйте снова, чтобы продолжить.`)
      else if (!s.complete && s.failed === 0)
        parts.push("Есть более ранняя история: синхронизируйте снова, чтобы продолжить.")
      return parts.length > 0 ? parts.join(" ") : null
    },
    done: (what) =>
      what === "meetings"
        ? "Теперь ваши агенты могут читать их расшифровки."
        : "Теперь ваши агенты могут искать по ним.",
    progress: (p) => {
      const fetched = ru3(p.fetched, RU_WHAT.messages.new)
      if (!p.chats || p.chatsDone === null) return fetched
      return `Чат ${formatNumber(Math.min(p.chats, p.chatsDone + 1), "ru")} из ${formatNumber(p.chats, "ru")} · ${fetched}`
    },
    advice: {
      timeout: "Время вышло",
      busy: "Идёт другая синхронизация",
      update: "Нужно обновление",
      signedOut: "Вход сброшен",
      keyring: "Не удалось прочитать вход",
      rateLimited: "Синхронизация на паузе",
      unreachable: "Сервис недоступен",
      refused: "Инструмент отклонил команду",
      failed: "Синхронизация не удалась",
    },
    adviceText: (kind, account, message, logs) => {
      switch (kind) {
        case "timeout":
          return "Полученное сохранено. Синхронизируйте снова, чтобы продолжить с места остановки."
        case "busy":
          return `Сейчас ${account} синхронизирует что-то другое или инструмент обновляется. Синхронизируйте снова, когда это закончится.`
        case "update":
          return "Более новый инструмент WireCat изменил хранилище. Обновите этот инструмент на странице «Инструменты» и синхронизируйте снова."
        case "signedOut":
          return `Войдите в ${account} снова, затем синхронизируйте.`
        case "keyring":
          return "Хранилище паролей компьютера было закрыто. Синхронизируйте снова через минуту."
        case "rateLimited":
          return "Полученное сохранено. Подождите немного и синхронизируйте снова."
        case "unreachable":
          return "Проверьте подключение к интернету и синхронизируйте снова."
        case "refused":
          return "Инструмент не принял команду синхронизации от WireCat. Скорее всего, он старее или новее, чем ожидает это приложение."
        case "failed":
          return `${message || "Синхронизация закончилась без объяснений."}${logs ? " Что произошло, видно в её запуске на странице «Журнал»." : ""}`
      }
    },
  },
}

const es: typeof en = {
  sync: {
    lastUnknown: "Última sincronización desconocida: la herramienta no lo dice",
    lastSynced: (ago) => `Última sincronización: ${ago}`,
    left: (what, n) => `faltan ${esCount(n, ES_WHAT[what].noun)}`,
    notFinished: (left) => `Sin terminar: ${left}`,
    noneRecorded: "Aún no hay sincronizaciones desde esta app",
    region: (name) => `Sincronizar ${name}`,
    readingLast: "Leyendo la última sincronización",
    stop: "Detener",
    stopping: "Deteniendo…",
    syncNow: "Sincronizar ahora",
    syncAgain: "Sincronizar de nuevo",
    anotherRunning: "Ya hay otra sincronización de esta cuenta en curso. Espera a que termine y vuelve a sincronizar.",
    stoppingKeeping: "Deteniendo; lo recibido se conserva",
    starting: "Iniciando",
    syncing: "Sincronizando",
    stopped: "Detenida",
    stoppedNext: "Lo recibido se conserva. La próxima sincronización sigue desde ahí.",
    signIn: "Iniciar sesión",
    update: (name) => `Actualizar ${name}`,
    openRun: "Abrir la ejecución en Registros",
    details: "Detalles",
    slowDown: (service, wait) =>
      `Las solicitudes a ${service} están en pausa por ahora. Lo recibido se conserva. ${
        wait
          ? `Vuelve a sincronizar después de las ${clockOf(wait.at, "es")}, dentro de unos ${plural("es", wait.minutes, { one: "# minuto", other: "# minutos" })}.`
          : "Espera unos minutos antes de volver a sincronizar."
      } La sincronización sigue desde donde se detuvo. WireCat no lo reintenta por sí solo.`,
    dismiss: "Descartar",
    rowStopped: "Sincronización detenida; lo recibido se conserva",
    rowFailed: (title) => `Sincronización: ${title}`,
    stopSyncing: (name) => `Detener la sincronización de ${name}`,
    syncNamed: (name) => `Sincronizar ${name} ahora`,
    stopTitle: "Detener la sincronización",
    result: (what, s) => {
      if (s.new === 0) return `Al día: ${ES_WHAT[what].none}`
      const where = s.places > 0 ? ` en ${esCount(s.places, ES_WHAT[what].place)}` : ""
      return `Sincronizado: ${esNew(what, s.new)}${where}`
    },
    next: (what, s) => {
      const parts: string[] = []
      if (s.failed > 0)
        parts.push(
          what === "meetings"
            ? `Con aviso: ${esNew(what, s.failed)}. La próxima sincronización lo vuelve a intentar.`
            : `No se pudo leer: ${esCount(s.failed, ES_WHAT[what].place)}. La próxima sincronización lo vuelve a intentar.`,
        )
      if (s.left > 0) parts.push(`Faltan ${esNew(what, s.left)}: sincroniza de nuevo para seguir.`)
      else if (!s.complete && s.failed === 0) parts.push("Hay más historial: sincroniza de nuevo para seguir.")
      return parts.length > 0 ? parts.join(" ") : null
    },
    done: (what) =>
      what === "meetings"
        ? "Tus agentes ya pueden leer sus transcripciones."
        : "Tus agentes ya pueden buscar en ellos.",
    progress: (p) => {
      const fetched = esNew("messages", p.fetched)
      if (!p.chats || p.chatsDone === null) return fetched
      return `Chat ${formatNumber(Math.min(p.chats, p.chatsDone + 1), "es")} de ${formatNumber(p.chats, "es")} · ${fetched}`
    },
    advice: {
      timeout: "Se alcanzó el tiempo límite",
      busy: "Hay otra sincronización en curso",
      update: "Hace falta una actualización",
      signedOut: "Sesión cerrada",
      keyring: "No se pudo leer la sesión",
      rateLimited: "La sincronización está en pausa",
      unreachable: "No se pudo conectar con el servicio",
      refused: "La herramienta rechazó el comando",
      failed: "La sincronización falló",
    },
    adviceText: (kind, account, message, logs) => {
      switch (kind) {
        case "timeout":
          return "Lo recibido se conserva. Sincroniza de nuevo para seguir desde donde se detuvo."
        case "busy":
          return `Algo más está sincronizando ${account} ahora mismo, o la herramienta se está actualizando. Sincroniza de nuevo cuando termine.`
        case "update":
          return "Una herramienta de WireCat más nueva cambió el almacenamiento. Actualiza esta herramienta en la página Herramientas y vuelve a sincronizar."
        case "signedOut":
          return `Vuelve a iniciar sesión en ${account} y sincroniza.`
        case "keyring":
          return "El almacén de contraseñas del ordenador estaba cerrado. Sincroniza de nuevo dentro de un minuto."
        case "rateLimited":
          return "Lo recibido se conserva. Espera un rato y vuelve a sincronizar."
        case "unreachable":
          return "Comprueba la conexión a internet y vuelve a sincronizar."
        case "refused":
          return "La herramienta no aceptó el comando de sincronización que envió WireCat. Probablemente es más antigua o más nueva de lo que espera esta app."
        case "failed":
          return `${message || "La sincronización terminó sin decir cómo."}${logs ? " Su ejecución en la página Registros muestra qué pasó." : ""}`
      }
    },
  },
}

export type SyncText = (typeof en)["sync"]
export const syncMessages: Messages<typeof en> = { en, ru, es }
