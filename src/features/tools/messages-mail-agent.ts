import { type Messages, plural } from "@/i18n"

const en = {
  title: "Mail agent",
  what: "Reads new mail and proposes tasks, invoices, orders and facts for you to accept. It never sends anything and never decides for you.",
  toggle: "Run on a schedule",
  toggleHelp: (every: string) =>
    `Checks for new mail every ${every} and runs in Claude Code. One run costs at most $1.`,
  every: "How often",
  changing: "Changing…",
  failedEvery: (message: string) => `Could not change how often it runs: ${message}`,
  turningOn: "Turning on…",
  turningOff: "Turning off…",
  noMemo: "The mail agent runs in Memo. Install Memo to use it.",
  openMemo: "Open Memo",
  old: (version: string | null, need: string) =>
    `${version ? `Memo ${version}` : "This Memo"} is too old for the mail agent. Update it to ${need} or later.`,
  noHarness: "Claude Code is not installed. The agent runs in it: install Claude Code, then turn this on.",
  aboutClaude: "About Claude Code",
  lastRun: (ago: string) => `Last run ${ago}`,
  ok: "finished",
  failed: (times: number | null) => (times && times > 1 ? `failed ${times} times in a row` : "failed"),
  skipped: (ago: string, why: string) => `Last start skipped ${ago}: ${why}`,
  // Keyed by the reason id memo sends with a skip; an id missing here shows memo's own English sentence.
  skipReasons: {
    "cost.day-cap": "the daily cost limit is reached; it runs again tomorrow",
    "mail.none-new": "no new mail since the last check",
    "mail.below-threshold": "some mail is waiting, but not enough of it yet to start a run",
  } as Record<string, string>,
  noRunYet: "No run yet. It starts once new mail arrives.",
  spentToday: (usd: string, cap: string | null) => `Spent today: ${usd}${cap ? ` of ${cap}` : ""}`,
  waiting: (n: number) => plural("en", n, { one: "# proposal waits for you", other: "# proposals wait for you" }),
  noneWaiting: "Nothing waits for your decision.",
  review: "Review them in a terminal:",
  copyReview: "Copy the review command",
  failedOn: (message: string) => `Could not turn the mail agent on: ${message}`,
  failedOff: (message: string) => `Could not turn the mail agent off: ${message}`,
  readFailed: (message: string) => `Could not read the schedule: ${message}`,
}

const ru: typeof en = {
  title: "Почтовый агент",
  what: "Читает новую почту и предлагает задачи, счета, заказы и факты, которые вы принимаете сами. Он ничего не отправляет и ничего не решает за вас.",
  toggle: "Запускать по расписанию",
  toggleHelp: (every) =>
    `Проверяет новую почту каждые ${every} и работает в Claude Code. Один запуск стоит не больше $1.`,
  every: "Как часто",
  changing: "Меняю…",
  failedEvery: (message) => `Не удалось изменить частоту запуска: ${message}`,
  turningOn: "Включаю…",
  turningOff: "Выключаю…",
  noMemo: "Почтовый агент работает в Memo. Установите Memo, чтобы им пользоваться.",
  openMemo: "Открыть Memo",
  old: (version, need) =>
    `${version ? `Memo ${version}` : "Эта версия Memo"} слишком старая для почтового агента. Обновите её до ${need} или новее.`,
  noHarness: "Claude Code не установлен. Агент работает в нём: установите Claude Code, затем включите агента.",
  aboutClaude: "О Claude Code",
  lastRun: (ago) => `Последний запуск ${ago}`,
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
  skipped: (ago, why) => `Запуск пропущен ${ago}: ${why}`,
  skipReasons: {
    "cost.day-cap": "дневной лимит расходов исчерпан; завтра запуск продолжится",
    "mail.none-new": "с прошлой проверки новой почты нет",
    "mail.below-threshold": "почта ждёт, но её пока слишком мало для запуска",
  },
  noRunYet: "Запусков ещё не было. Агент начнёт, когда придёт новая почта.",
  spentToday: (usd, cap) => `Потрачено сегодня: ${usd}${cap ? ` из ${cap}` : ""}`,
  waiting: (n) =>
    plural("ru", n, {
      one: "# предложение ждёт вашего решения",
      few: "# предложения ждут вашего решения",
      many: "# предложений ждут вашего решения",
      other: "# предложения ждут вашего решения",
    }),
  noneWaiting: "Ничего не ждёт вашего решения.",
  review: "Просмотреть их в терминале:",
  copyReview: "Скопировать команду просмотра",
  failedOn: (message) => `Не удалось включить почтового агента: ${message}`,
  failedOff: (message) => `Не удалось выключить почтового агента: ${message}`,
  readFailed: (message) => `Не удалось прочитать расписание: ${message}`,
}

const es: typeof en = {
  title: "Agente de correo",
  what: "Lee el correo nuevo y propone tareas, facturas, pedidos y datos para que tú los aceptes. Nunca envía nada ni decide por ti.",
  toggle: "Ejecutar con horario",
  toggleHelp: (every) =>
    `Busca correo nuevo cada ${every} y se ejecuta en Claude Code. Cada ejecución cuesta como mucho 1 $.`,
  every: "Con qué frecuencia",
  changing: "Cambiando…",
  failedEvery: (message) => `No se pudo cambiar la frecuencia: ${message}`,
  turningOn: "Activando…",
  turningOff: "Desactivando…",
  noMemo: "El agente de correo funciona en Memo. Instala Memo para usarlo.",
  openMemo: "Abrir Memo",
  old: (version, need) =>
    `${version ? `Memo ${version}` : "Esta versión de Memo"} es demasiado antigua para el agente de correo. Actualízala a ${need} o posterior.`,
  noHarness:
    "Claude Code no está instalado. El agente se ejecuta en él: instala Claude Code y luego enciende el agente.",
  aboutClaude: "Acerca de Claude Code",
  lastRun: (ago) => `Última ejecución ${ago}`,
  ok: "terminó bien",
  failed: (times) => (times && times > 1 ? `falló ${times} veces seguidas` : "falló"),
  skipped: (ago, why) => `Ejecución omitida ${ago}: ${why}`,
  skipReasons: {
    "cost.day-cap": "se alcanzó el límite diario de gasto; mañana se ejecuta de nuevo",
    "mail.none-new": "no hay correo nuevo desde la última revisión",
    "mail.below-threshold": "hay correo esperando, pero aún es poco para iniciar una ejecución",
  },
  noRunYet: "Aún no se ha ejecutado. Empieza cuando llegue correo nuevo.",
  spentToday: (usd, cap) => `Gastado hoy: ${usd}${cap ? ` de ${cap}` : ""}`,
  waiting: (n) => plural("es", n, { one: "# propuesta espera tu decisión", other: "# propuestas esperan tu decisión" }),
  noneWaiting: "Nada espera tu decisión.",
  review: "Revisa las propuestas en una terminal:",
  copyReview: "Copiar el comando de revisión",
  failedOn: (message) => `No se pudo activar el agente de correo: ${message}`,
  failedOff: (message) => `No se pudo desactivar el agente de correo: ${message}`,
  readFailed: (message) => `No se pudo leer el horario: ${message}`,
}

export type MailAgentText = typeof en
export const mailAgentMessages: Messages<typeof en> = { en, ru, es }
