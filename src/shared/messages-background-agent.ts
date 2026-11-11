import type { Messages } from "@/i18n"
import type { TroubleKind } from "@/platform/bindings"

const en = {
  names: { claude: "Claude Code", codex: "Codex" } as Record<string, string>,
  heading: "Agent for background jobs",
  help: "The mail agent runs in it on a schedule. With both installed, nothing runs until you choose.",
  pick: "Not chosen",
  installed: "Installed",
  notInstalled: "Not installed",
  notSignedIn: "Installed, not signed in",
  onlyOne: (name: string) => `Only ${name} is installed, so background jobs run in it.`,
  use: "Use this agent",
  same: "This agent is already in use.",
  need: "Choose an agent first.",
  chooseFailed: "Your choice was not saved.",
  failed: "Could not list the agents.",
  looking: "Looking for agents on this computer…",
  none: "Neither Claude Code nor Codex is installed. Install one of them to run background jobs.",
  digests: "Digests are written by Claude Code for now: they cannot run in another agent yet.",
  codexNoCap: "Codex does not report what a run costs, so the cost limits do not stop its runs.",
  trouble: {
    noCredit: (name: string) => `${name} has no credit left, so the run failed.`,
    limit: (name: string) => `${name} reached its usage limit, so the run failed.`,
    signedOut: (name: string) => `${name} is not signed in, so the run failed. Sign in to it in a terminal.`,
  } as Record<TroubleKind, (name: string) => string>,
  theAgent: "The agent",
  runVia: (name: string) => `Run through ${name}`,
}

const ru: typeof en = {
  names: { claude: "Claude Code", codex: "Codex" },
  heading: "Агент для фоновых задач",
  help: "В нём по расписанию работает почтовый агент. Если установлены оба, ничего не запускается, пока вы не выберете.",
  pick: "Не выбран",
  installed: "Установлен",
  notInstalled: "Не установлен",
  notSignedIn: "Установлен, вход не выполнен",
  onlyOne: (name) => `Установлен только ${name}, поэтому фоновые задачи работают в нём.`,
  use: "Использовать этого агента",
  same: "Этот агент уже используется.",
  need: "Сначала выберите агента.",
  chooseFailed: "Выбор не сохранился.",
  failed: "Не удалось получить список агентов.",
  looking: "Ищем агентов на этом компьютере…",
  none: "Не установлен ни Claude Code, ни Codex. Установите одного из них, чтобы запускать фоновые задачи.",
  digests: "Сводки пока пишет Claude Code: запустить их в другом агенте пока нельзя.",
  codexNoCap: "Codex не сообщает, сколько стоит запуск, поэтому лимиты расходов его запуски не останавливают.",
  trouble: {
    noCredit: (name) => `У ${name} закончились деньги на счёте, поэтому запуск не удался.`,
    limit: (name) => `${name} исчерпал лимит использования, поэтому запуск не удался.`,
    signedOut: (name) => `В ${name} не выполнен вход, поэтому запуск не удался. Войдите в него в терминале.`,
  },
  theAgent: "Агент",
  runVia: (name) => `Запустить через ${name}`,
}

const es: typeof en = {
  names: { claude: "Claude Code", codex: "Codex" },
  heading: "Agente para tareas en segundo plano",
  help: "El agente de correo se ejecuta en él con horario. Si ambos están instalados, nada se ejecuta hasta que elijas.",
  pick: "Sin elegir",
  installed: "Instalado",
  notInstalled: "No instalado",
  notSignedIn: "Instalado, sin iniciar sesión",
  onlyOne: (name) => `Solo ${name} está instalado, así que las tareas en segundo plano se ejecutan en él.`,
  use: "Usar este agente",
  same: "Este agente ya está en uso.",
  need: "Elige primero un agente.",
  chooseFailed: "No se guardó tu elección.",
  failed: "No se pudo obtener la lista de agentes.",
  looking: "Buscando agentes en este equipo…",
  none: "No está instalado ni Claude Code ni Codex. Instala uno de ellos para ejecutar tareas en segundo plano.",
  digests: "Por ahora los resúmenes los escribe Claude Code: todavía no pueden ejecutarse en otro agente.",
  codexNoCap:
    "Codex no informa de cuánto cuesta una ejecución, así que los límites de gasto no detienen sus ejecuciones.",
  trouble: {
    noCredit: (name) => `${name} no tiene saldo, así que la ejecución falló.`,
    limit: (name) => `${name} llegó a su límite de uso, así que la ejecución falló.`,
    signedOut: (name) =>
      `${name} no tiene la sesión iniciada, así que la ejecución falló. Inicia sesión en una terminal.`,
  },
  theAgent: "El agente",
  runVia: (name) => `Ejecutar con ${name}`,
}

export type BackgroundAgentText = typeof en
export const backgroundAgentMessages: Messages<typeof en> = { en, ru, es }
