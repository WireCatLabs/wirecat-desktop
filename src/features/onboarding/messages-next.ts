import type { Messages } from "@/i18n"

const en = {
  can: (tool: string) => `What you can do with ${tool}`,
  addAccount: "Add an account",
  addAnother: "Add another account",
  accountHint: "Each account is a profile. Your agent names the one it uses.",
  sync: "Start a sync",
  syncHint: "Brings what is new to this computer, so search and your agent see it.",
  service: "Keep it running in the background",
  serviceHint: "New messages arrive while WireCat is closed.",
  skill: "Give your agents its skill",
  skillHint: "Claude Code, Codex and other agents learn which commands to run.",
  mcp: "Connect ChatGPT or Claude in the browser",
  mcpHint: "Through its MCP server, for apps that cannot run commands.",
  logs: "See what it ran",
  logsHint: "Every run on the Logs page, and what went wrong.",
  docs: "Read its documentation",
}

type NextText = typeof en

const ru: NextText = {
  can: (tool) => `Что можно сделать с ${tool}`,
  addAccount: "Добавить аккаунт",
  addAnother: "Добавить ещё один аккаунт",
  accountHint: "Каждый аккаунт хранится как отдельный профиль. Агент указывает, какой из них использовать.",
  sync: "Запустить синхронизацию",
  syncHint: "Загружает новое на этот компьютер, чтобы его видели поиск и агент.",
  service: "Оставить работать в фоне",
  serviceHint: "Новые сообщения приходят, даже когда WireCat закрыт.",
  skill: "Дать агентам навык",
  skillHint: "Claude Code, Codex и другие агенты узнают, какие команды запускать.",
  mcp: "Подключить ChatGPT или Claude в браузере",
  mcpHint: "Через MCP-сервер, для приложений, которые не умеют запускать команды.",
  logs: "Посмотреть, что он запускал",
  logsHint: "Все запуски на странице «Журнал» и что пошло не так.",
  docs: "Открыть документацию",
}

const es: NextText = {
  can: (tool) => `Qué puedes hacer con ${tool}`,
  addAccount: "Añadir una cuenta",
  addAnother: "Añadir otra cuenta",
  accountHint: "Cada cuenta es un perfil. Tu agente indica cuál usa.",
  sync: "Sincronizar ahora",
  syncHint: "Trae lo nuevo a este ordenador, para que lo vean la búsqueda y tu agente.",
  service: "Mantenerlo en segundo plano",
  serviceHint: "Los mensajes nuevos llegan aunque WireCat esté cerrado.",
  skill: "Dar su habilidad a tus agentes",
  skillHint: "Claude Code, Codex y otros agentes aprenden qué comandos ejecutar.",
  mcp: "Conectar ChatGPT o Claude en el navegador",
  mcpHint: "Con su servidor MCP, para apps que no pueden ejecutar comandos.",
  logs: "Ver lo que ejecutó",
  logsHint: "Cada ejecución en la página Registros, y qué falló.",
  docs: "Leer su documentación",
}

export const nextMessages: Messages<NextText> = { en, ru, es }
