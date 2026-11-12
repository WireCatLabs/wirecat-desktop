import type { Messages } from "@/i18n"
import type { AgentState } from "@/platform/background-agent-schemas"
import type { TroubleKind } from "@/platform/bindings"

const en = {
  heading: "Agent for background jobs",
  help: "The mail agent and the digests run in it on a schedule. With several ready, nothing runs until you choose.",
  pick: "Not chosen",
  states: {
    ready: "Ready",
    notInstalled: "Not installed",
    programMissing: "Its program is not found",
    notSupported: "Cannot run on a schedule yet",
    needsNewerMemo: "Needs a newer Memo",
    unrestricted: "Its commands cannot be limited",
  } as Record<AgentState, string>,
  notSignedIn: "Ready, not signed in",
  warned: "Ready after a warning",
  warning: {
    title: (name: string) => `Run background jobs in ${name}?`,
    why: (name: string) =>
      `Memo cannot limit the commands ${name} runs. A background job reads your mail and messages, and a message can ask the agent to do things.`,
    can: (name: string) => `${name} can still run any program on this computer and read your files.`,
    memo: (reason: string) => `Memo says: ${reason}`,
    once: "You are asked once for this agent.",
    accept: (name: string) => `I understand, use ${name}`,
    cancel: "Cancel",
  },
  greyed:
    "Greyed agents cannot run background jobs. «Its program is not found»: its settings are on this computer, but its command is not, so install it again. «Cannot run on a schedule yet»: Memo cannot start it without you. «Its commands cannot be limited»: a job reads your mail and messages, and a message could make such an agent run anything on this computer, so it does not run background jobs. Memo's reason is under the list.",
  oldMemo: "This Memo knows only Claude Code and Codex. Update Memo to run background jobs in other agents.",
  openMemo: "Open Memo",
  onlyOne: (name: string) => `Only ${name} is ready, so background jobs run in it.`,
  use: "Use this agent",
  same: "This agent is already in use.",
  need: "Choose an agent first.",
  notReady: "This agent cannot run background jobs. Choose a ready one.",
  chooseFailed: "Your choice was not saved.",
  failed: "Could not list the agents.",
  looking: "Looking for agents on this computer…",
  none: "No agent on this computer can run background jobs. The list says why for each.",
  digests: "Digests are written by Claude Code until you update Memo.",
  noCost: (name: string) => `${name} does not report what a run costs, so the cost limits do not stop its runs.`,
  trouble: {
    noCredit: (name: string) => `${name} has no credit left, so the run failed.`,
    limit: (name: string) => `${name} reached its usage limit, so the run failed.`,
    signedOut: (name: string) => `${name} is not signed in, so the run failed. Sign in to it in a terminal.`,
  } as Record<TroubleKind, (name: string) => string>,
  theAgent: "The agent",
  switchTo: (name: string) => `Switch to ${name}`,
  runsIn: (name: string) => `Written by ${name}.`,
}

const ru: typeof en = {
  heading: "Агент для фоновых задач",
  help: "В нём по расписанию работают почтовый агент и сводки. Если готовы несколько, ничего не запускается, пока вы не выберете.",
  pick: "Не выбран",
  states: {
    ready: "Готов",
    notInstalled: "Не установлен",
    programMissing: "Не найдена его программа",
    notSupported: "Пока не умеет работать по расписанию",
    needsNewerMemo: "Нужна более новая Memo",
    unrestricted: "Его команды нельзя ограничить",
  },
  notSignedIn: "Готов, вход не выполнен",
  warned: "Готов после предупреждения",
  warning: {
    title: (name) => `Запускать фоновые задачи в ${name}?`,
    why: (name) =>
      `Memo не может ограничить команды, которые выполняет ${name}. Фоновая задача читает вашу почту и сообщения, а сообщение может попросить агента что-то сделать.`,
    can: (name) => `${name} всё равно может запустить любую программу на этом компьютере и прочитать ваши файлы.`,
    memo: (reason) => `Memo сообщает: ${reason}`,
    once: "Для этого агента это спрашивается один раз.",
    accept: (name) => `Понимаю, использовать ${name}`,
    cancel: "Отмена",
  },
  greyed:
    "Серые агенты не могут выполнять фоновые задачи. «Не найдена его программа»: его настройки на компьютере есть, а команды нет, поэтому установите его заново. «Пока не умеет работать по расписанию»: Memo не может запустить его без вас. «Его команды нельзя ограничить»: задача читает вашу почту и сообщения, и сообщение может заставить такого агента сделать на компьютере что угодно, поэтому фоновые задачи он не выполняет. Причина от Memo указана под списком.",
  oldMemo: "Эта Memo знает только Claude Code и Codex. Обновите Memo, чтобы запускать фоновые задачи в других агентах.",
  openMemo: "Открыть Memo",
  onlyOne: (name) => `Готов только ${name}, поэтому фоновые задачи работают в нём.`,
  use: "Использовать этого агента",
  same: "Этот агент уже используется.",
  need: "Сначала выберите агента.",
  notReady: "Этот агент не может выполнять фоновые задачи. Выберите готового.",
  chooseFailed: "Выбор не сохранился.",
  failed: "Не удалось получить список агентов.",
  looking: "Ищем агентов на этом компьютере…",
  none: "Ни один агент на этом компьютере не может выполнять фоновые задачи. В списке сказано, почему для каждого.",
  digests: "Сводки пишет Claude Code, пока вы не обновите Memo.",
  noCost: (name) => `${name} не сообщает, сколько стоит запуск, поэтому лимиты расходов его запуски не останавливают.`,
  trouble: {
    noCredit: (name) => `У ${name} закончились деньги на счёте, поэтому запуск не удался.`,
    limit: (name) => `${name} исчерпал лимит использования, поэтому запуск не удался.`,
    signedOut: (name) => `В ${name} не выполнен вход, поэтому запуск не удался. Войдите в него в терминале.`,
  },
  theAgent: "Агент",
  switchTo: (name) => `Перевести на ${name}`,
  runsIn: (name) => `Пишет ${name}.`,
}

const es: typeof en = {
  heading: "Agente para tareas en segundo plano",
  help: "El agente de correo y los resúmenes se ejecutan en él con horario. Si hay varios listos, nada se ejecuta hasta que elijas.",
  pick: "Sin elegir",
  states: {
    ready: "Listo",
    notInstalled: "No instalado",
    programMissing: "No se encuentra su programa",
    notSupported: "Aún no puede ejecutarse con horario",
    needsNewerMemo: "Necesita un Memo más reciente",
    unrestricted: "Sus comandos no se pueden limitar",
  },
  notSignedIn: "Listo, sin iniciar sesión",
  warned: "Listo tras un aviso",
  warning: {
    title: (name) => `¿Ejecutar las tareas en segundo plano en ${name}?`,
    why: (name) =>
      `Memo no puede limitar los comandos que ejecuta ${name}. Una tarea en segundo plano lee tu correo y tus mensajes, y un mensaje puede pedirle al agente que haga cosas.`,
    can: (name) => `${name} aún puede ejecutar cualquier programa de este equipo y leer tus archivos.`,
    memo: (reason) => `Memo dice: ${reason}`,
    once: "Se pregunta una sola vez para este agente.",
    accept: (name) => `Entiendo, usar ${name}`,
    cancel: "Cancelar",
  },
  greyed:
    "Los agentes en gris no pueden ejecutar tareas en segundo plano. «No se encuentra su programa»: su configuración está en este equipo, pero su comando no, así que vuelve a instalarlo. «Aún no puede ejecutarse con horario»: Memo no puede iniciarlo sin ti. «Sus comandos no se pueden limitar»: una tarea lee tu correo y tus mensajes, y un mensaje podría hacer que ese agente ejecute cualquier cosa en este equipo, así que no ejecuta tareas en segundo plano. El motivo de Memo está debajo de la lista.",
  oldMemo:
    "Este Memo solo conoce Claude Code y Codex. Actualiza Memo para ejecutar tareas en segundo plano en otros agentes.",
  openMemo: "Abrir Memo",
  onlyOne: (name) => `Solo ${name} está listo, así que las tareas en segundo plano se ejecutan en él.`,
  use: "Usar este agente",
  same: "Este agente ya está en uso.",
  need: "Elige primero un agente.",
  notReady: "Este agente no puede ejecutar tareas en segundo plano. Elige uno listo.",
  chooseFailed: "No se guardó tu elección.",
  failed: "No se pudo obtener la lista de agentes.",
  looking: "Buscando agentes en este equipo…",
  none: "Ningún agente de este equipo puede ejecutar tareas en segundo plano. La lista dice por qué para cada uno.",
  digests: "Los resúmenes los escribe Claude Code hasta que actualices Memo.",
  noCost: (name) =>
    `${name} no informa de cuánto cuesta una ejecución, así que los límites de gasto no detienen sus ejecuciones.`,
  trouble: {
    noCredit: (name) => `${name} no tiene saldo, así que la ejecución falló.`,
    limit: (name) => `${name} llegó a su límite de uso, así que la ejecución falló.`,
    signedOut: (name) =>
      `${name} no tiene la sesión iniciada, así que la ejecución falló. Inicia sesión en una terminal.`,
  },
  theAgent: "El agente",
  switchTo: (name) => `Cambiar a ${name}`,
  runsIn: (name) => `Lo escribe ${name}.`,
}

export type BackgroundAgentText = typeof en
export const backgroundAgentMessages: Messages<typeof en> = { en, ru, es }
