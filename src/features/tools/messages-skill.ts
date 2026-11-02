import type { Messages } from "@/i18n"

const en = {
  title: (tool: string) => `Teach your AI agents to use ${tool}`,
  benefits: "What the skill gives",
  points: [
    {
      title: "Ask in your own words",
      text: (tool: string) =>
        `The skill is a short guide to ${tool}'s commands and when to use them, so your agent knows what to run.`,
    },
    {
      title: "Light on context",
      text: (tool: string) =>
        `Until you ask about ${tool}, the agent keeps only a one-line description of it in mind. It reads the full guide when the task needs it.`,
    },
    {
      title: "Stays on this computer",
      text: () => "It is a file in your agents' skills folder. Remove it any time on the Agents page.",
    },
  ],
  add: (agents: string) => `Add the skill for ${agents}`,
  adding: "Adding…",
  added: (agents: string, tool: string) => `${agents} can now use ${tool}.`,
  already: (agents: string, tool: string) => `The ${tool} skill is already there for ${agents}.`,
  looking: "Looking for AI agents on this computer…",
  noAgent:
    "No AI agent was found on this computer. Install Claude Code, Codex or another agent, then add the skill on the Agents page.",
  unclear: (tool: string) =>
    `${tool} could not say whether its skill is already there. The Agents page shows each agent and adds it.`,
  openAgents: "Open Agents",
  failed: "The skill could not be added.",
}

export type SkillText = typeof en

const ru: SkillText = {
  title: (tool) => `Научите ИИ-агентов работать с ${tool}`,
  benefits: "Что даёт навык",
  points: [
    {
      title: "Просите своими словами",
      text: (tool) =>
        `Навык — это короткое руководство по командам ${tool} и тому, когда их использовать, чтобы агент знал, что запускать.`,
    },
    {
      title: "Почти не занимает контекст",
      text: (tool) =>
        `Пока вы не спросите про ${tool}, агент держит в памяти только однострочное описание. Полное руководство он читает, когда оно нужно для задачи.`,
    },
    {
      title: "Остаётся на этом компьютере",
      text: () => "Это файл в папке навыков ваших агентов. Удалить его можно в любой момент на странице «Агенты».",
    },
  ],
  add: (agents) => `Добавить навык для ${agents}`,
  adding: "Добавляем…",
  added: (agents, tool) => `Навык ${tool} добавлен для ${agents}.`,
  already: (agents, tool) => `Навык ${tool} у ${agents} уже есть.`,
  looking: "Ищем ИИ-агентов на этом компьютере…",
  noAgent:
    "На этом компьютере не найдено ни одного ИИ-агента. Установите Claude Code, Codex или другого агента, затем добавьте навык на странице «Агенты».",
  unclear: (tool) =>
    `${tool} не смог сообщить, добавлен ли уже его навык. На странице «Агенты» видно каждого агента, там же навык можно добавить.`,
  openAgents: "Открыть «Агенты»",
  failed: "Не удалось добавить навык.",
}

const es: SkillText = {
  title: (tool) => `Enseña a tus agentes de IA a usar ${tool}`,
  benefits: "Lo que aporta la habilidad",
  points: [
    {
      title: "Pide con tus propias palabras",
      text: (tool) =>
        `La habilidad es una guía breve de los comandos de ${tool} y de cuándo usarlos, para que tu agente sepa qué ejecutar.`,
    },
    {
      title: "Apenas ocupa contexto",
      text: (tool) =>
        `Hasta que preguntes por ${tool}, el agente solo guarda una descripción de una línea. Lee la guía completa cuando la tarea la necesita.`,
    },
    {
      title: "Se queda en este equipo",
      text: () =>
        "Es un archivo en la carpeta de habilidades de tus agentes. Quítalo cuando quieras en la página Agentes.",
    },
  ],
  add: (agents) => `Añadir la habilidad para ${agents}`,
  adding: "Añadiendo…",
  added: (agents, tool) => `Habilidad de ${tool} añadida para ${agents}.`,
  already: (agents, tool) => `${agents} ya tiene la habilidad de ${tool}.`,
  looking: "Buscando agentes de IA en este equipo…",
  noAgent:
    "No se encontró ningún agente de IA en este equipo. Instala Claude Code, Codex u otro agente y luego añade la habilidad en la página Agentes.",
  unclear: (tool) =>
    `${tool} no pudo decir si su habilidad ya está añadida. La página Agentes muestra cada agente y permite añadirla.`,
  openAgents: "Abrir Agentes",
  failed: "No se pudo añadir la habilidad.",
}

export const skillOfferMessages: Messages<SkillText> = { en, ru, es }
