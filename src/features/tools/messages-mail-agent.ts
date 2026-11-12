import { type Messages, plural } from "@/i18n"

const en = {
  title: "Mail agent",
  what: "Reads new mail and proposes tasks, invoices, orders and facts for you to accept. It never sends anything and never decides for you.",
  toggle: "Run on a schedule",
  toggleHelp: (every: string, agent: string | null, capped: boolean) =>
    `Checks for new mail every ${every}${agent ? ` and runs in ${agent}` : ""}.${capped ? " One run costs at most $1." : ""}`,
  every: "How often",
  changing: "Changing…",
  failedEvery: "Could not change how often it runs.",
  turningOn: "Turning on…",
  turningOff: "Turning off…",
  noMemo: "The mail agent runs in Memo. Install Memo to use it.",
  openMemo: "Open Memo",
  old: (version: string | null, need: string) =>
    `${version ? `Memo ${version}` : "This Memo"} is too old for the mail agent. Update it to ${need} or later.`,
  noHarness: "No agent on this computer can run it. Settings, «Agent for background jobs», says why for each.",
  needAgent: "Choose the agent it runs in first.",
  pickOther: "Choose another agent for background jobs, then switch the mail agent to it.",
  resave: (name: string) =>
    `Memo now checks how each agent is started, so this schedule does not run until it is saved again. It is saved as it is: in ${name}, at the same interval.`,
  resaveUnknown:
    "Memo now checks how each agent is started, so this schedule does not run until it is saved again. Memo does not say which agent it ran in: turn it off and on again, and choose the agent.",
  resaveButton: "Save again",
  otherChosen: (chosen: string, running: string) =>
    `You chose ${chosen} for background jobs, but the mail agent still runs in ${running}.`,
  aboutClaude: "About Claude Code",
  lastRun: (ago: string) => `Last run ${ago}`,
  ok: "finished",
  failed: (times: number | null) => (times && times > 1 ? `failed ${times} times in a row` : "failed"),
  skipped: (ago: string, why: string) => `Last start skipped ${ago}: ${why}`,
  skippedUnknown: (ago: string) => `Last start skipped ${ago}.`,
  // Keyed by the reason id memo sends with a skip; an id missing here shows memo's own sentence under Details.
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
  failedOn: "Could not turn the mail agent on.",
  failedOff: "Could not turn the mail agent off.",
  readFailed: "Could not read the schedule.",
}

const ru: typeof en = {
  title: "Почтовый агент",
  what: "Читает новую почту и предлагает задачи, счета, заказы и факты, которые вы принимаете сами. Он ничего не отправляет и ничего не решает за вас.",
  toggle: "Запускать по расписанию",
  toggleHelp: (every, agent, capped) =>
    `Проверяет новую почту каждые ${every}${agent ? ` и работает в ${agent}` : ""}.${capped ? " Один запуск стоит не больше $1." : ""}`,
  every: "Как часто",
  changing: "Меняю…",
  failedEvery: "Не удалось изменить частоту запуска.",
  turningOn: "Включаю…",
  turningOff: "Выключаю…",
  noMemo: "Почтовый агент работает в Memo. Установите Memo, чтобы им пользоваться.",
  openMemo: "Открыть Memo",
  old: (version, need) =>
    `${version ? `Memo ${version}` : "Эта версия Memo"} слишком старая для почтового агента. Обновите её до ${need} или новее.`,
  noHarness:
    "Ни один агент на этом компьютере не может его запускать. В настройках, «Агент для фоновых задач», сказано, почему для каждого.",
  needAgent: "Сначала выберите, в каком агенте он работает.",
  pickOther: "Выберите другого агента для фоновых задач, затем переведите на него почтового агента.",
  resave: (name) =>
    `Memo теперь проверяет, как запускается каждый агент, поэтому это расписание не запускается, пока его не сохранят заново. Оно сохранится как есть: в ${name}, с тем же интервалом.`,
  resaveUnknown:
    "Memo теперь проверяет, как запускается каждый агент, поэтому это расписание не запускается, пока его не сохранят заново. Memo не сообщает, в каком агенте оно работало: выключите и включите его снова и выберите агента.",
  resaveButton: "Сохранить заново",
  otherChosen: (chosen, running) =>
    `Для фоновых задач вы выбрали ${chosen}, но почтовый агент пока работает в ${running}.`,
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
  skippedUnknown: (ago) => `Запуск пропущен ${ago}.`,
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
  failedOn: "Не удалось включить почтового агента.",
  failedOff: "Не удалось выключить почтового агента.",
  readFailed: "Не удалось прочитать расписание.",
}

const es: typeof en = {
  title: "Agente de correo",
  what: "Lee el correo nuevo y propone tareas, facturas, pedidos y datos para que tú los aceptes. Nunca envía nada ni decide por ti.",
  toggle: "Ejecutar con horario",
  toggleHelp: (every, agent, capped) =>
    `Busca correo nuevo cada ${every}${agent ? ` y se ejecuta en ${agent}` : ""}.${capped ? " Cada ejecución cuesta como mucho 1 $." : ""}`,
  every: "Con qué frecuencia",
  changing: "Cambiando…",
  failedEvery: "No se pudo cambiar la frecuencia.",
  turningOn: "Activando…",
  turningOff: "Desactivando…",
  noMemo: "El agente de correo funciona en Memo. Instala Memo para usarlo.",
  openMemo: "Abrir Memo",
  old: (version, need) =>
    `${version ? `Memo ${version}` : "Esta versión de Memo"} es demasiado antigua para el agente de correo. Actualízala a ${need} o posterior.`,
  noHarness:
    "Ningún agente de este equipo puede ejecutarlo. Ajustes, «Agente para tareas en segundo plano», dice por qué para cada uno.",
  needAgent: "Elige primero en qué agente se ejecuta.",
  pickOther: "Elige otro agente para las tareas en segundo plano y luego cambia el agente de correo a él.",
  resave: (name) =>
    `Memo ahora comprueba cómo se inicia cada agente, así que esta programación no se ejecuta hasta guardarla de nuevo. Se guarda tal cual: en ${name}, con el mismo intervalo.`,
  resaveUnknown:
    "Memo ahora comprueba cómo se inicia cada agente, así que esta programación no se ejecuta hasta guardarla de nuevo. Memo no dice en qué agente se ejecutaba: apágala y vuelve a encenderla, y elige el agente.",
  resaveButton: "Guardar de nuevo",
  otherChosen: (chosen, running) =>
    `Elegiste ${chosen} para las tareas en segundo plano, pero el agente de correo aún se ejecuta en ${running}.`,
  aboutClaude: "Acerca de Claude Code",
  lastRun: (ago) => `Última ejecución ${ago}`,
  ok: "terminó bien",
  failed: (times) => (times && times > 1 ? `falló ${times} veces seguidas` : "falló"),
  skipped: (ago, why) => `Ejecución omitida ${ago}: ${why}`,
  skippedUnknown: (ago) => `Ejecución omitida ${ago}.`,
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
  failedOn: "No se pudo activar el agente de correo.",
  failedOff: "No se pudo desactivar el agente de correo.",
  readFailed: "No se pudo leer el horario.",
}

export type MailAgentText = typeof en
export const mailAgentMessages: Messages<typeof en> = { en, ru, es }
