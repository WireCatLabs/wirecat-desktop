import type { Messages } from "@/i18n"

const en = {
  heading: "Reading pictures",
  intro:
    "WireCat reads no picture by itself. On request, your coding agent reads the text of one picture you choose, and search finds it from then on. Only you can turn it on.",
  mode: "When pictures are read",
  modes: { never: "Never", request: "On request" },
  agent: "Agent that reads",
  agents: { claude: "Claude Code", codex: "Codex" },
  model: "Model",
  modelHint: "Leave empty for the agent's own default.",
  warning:
    "The picture you ask to read goes to Claude Code or Codex and from there to its provider, unless that agent runs a model on this computer. The “Only this computer” setting does not stop it.",
  turnOn: "Turn on",
  save: "Save",
  cancel: "Cancel",
  onSince: (agent: string, model: string | null, when: string) =>
    `On request, read by ${agent}${model ? ` with ${model}` : ""} since ${when}.`,
  off: "Never. No picture leaves this computer for an agent.",
  ownerOnly:
    "Only you can turn this on, and WireCat was started from an AI agent's terminal. Open WireCat from the app menu and turn it on there.",
  agentMissing: "Choose the agent that reads: Claude Code or Codex.",
  setFailed: "Could not change it.",
  readFailed: "Could not read the picture reading setting.",
  looking: "Looking at the picture reading setting…",
}

const ru: typeof en = {
  heading: "Чтение картинок",
  intro:
    "Сам WireCat картинки не читает. По вашей просьбе ваш агент для кода читает текст одной выбранной картинки, и потом поиск его находит. Включить это можете только вы.",
  mode: "Когда читать картинки",
  modes: { never: "Никогда", request: "По запросу" },
  agent: "Какой агент читает",
  agents: { claude: "Claude Code", codex: "Codex" },
  model: "Модель",
  modelHint: "Оставьте пустым, и агент возьмет свою модель по умолчанию.",
  warning:
    "Картинка, которую вы просите прочитать, уходит в Claude Code или Codex и оттуда к его провайдеру, если только этот агент не работает с моделью на этом компьютере. Настройка «Только этот компьютер» это не останавливает.",
  turnOn: "Включить",
  save: "Сохранить",
  cancel: "Отмена",
  onSince: (agent, model, when) =>
    `По запросу, читает ${agent}${model ? ` с моделью ${model}` : ""}, включено с ${when}.`,
  off: "Никогда. Ни одна картинка не уходит агенту.",
  ownerOnly:
    "Включить это можете только вы, а WireCat запущен из терминала ИИ-агента. Откройте WireCat из меню приложений и включите там.",
  agentMissing: "Выберите агента, который читает: Claude Code или Codex.",
  setFailed: "Не удалось изменить.",
  readFailed: "Не удалось прочитать настройку чтения картинок.",
  looking: "Смотрим настройку чтения картинок…",
}

const es: typeof en = {
  heading: "Leer imágenes",
  intro:
    "WireCat no lee ninguna imagen por sí mismo. Cuando lo pides, tu agente de código lee el texto de una imagen que eliges, y desde entonces la búsqueda lo encuentra. Solo tú puedes activarlo.",
  mode: "Cuándo se leen las imágenes",
  modes: { never: "Nunca", request: "Cuando lo pidas" },
  agent: "Agente que lee",
  agents: { claude: "Claude Code", codex: "Codex" },
  model: "Modelo",
  modelHint: "Déjalo vacío para usar el modelo por defecto del agente.",
  warning:
    "La imagen que pides leer va a Claude Code o Codex y de ahí a su proveedor, salvo que ese agente use un modelo en este ordenador. El ajuste «Solo este ordenador» no lo impide.",
  turnOn: "Activar",
  save: "Guardar",
  cancel: "Cancelar",
  onSince: (agent, model, when) =>
    `Cuando lo pidas, lee ${agent}${model ? ` con ${model}` : ""}, activado desde ${when}.`,
  off: "Nunca. Ninguna imagen sale de este ordenador hacia un agente.",
  ownerOnly:
    "Solo tú puedes activarlo, y WireCat se abrió desde la terminal de un agente de IA. Abre WireCat desde el menú de aplicaciones y actívalo allí.",
  agentMissing: "Elige el agente que lee: Claude Code o Codex.",
  setFailed: "No se pudo cambiar.",
  readFailed: "No se pudo leer el ajuste de lectura de imágenes.",
  looking: "Mirando el ajuste de lectura de imágenes…",
}

export const pictureReadingMessages: Messages<typeof en> = { en, ru, es }
