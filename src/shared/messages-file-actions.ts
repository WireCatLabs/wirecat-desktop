import type { Messages } from "@/i18n"

type Agent = "claude" | "codex"
const AGENT: Record<Agent, string> = { claude: "Claude Code", codex: "Codex" }

const en = {
  read: "Read the picture",
  open: "Open the file",
  reading: "Your agent is reading the picture. It can take a minute.",
  readBy: (by: string) => `Read by ${by}:`,
  empty: "The agent found no text in this picture.",
  off: "Reading pictures is set to never, so no picture goes to an agent. Turn it on in Settings.",
  goSetting: "Open Reading pictures",
  unavailable: (agent: Agent) =>
    `${AGENT[agent]} is not installed on this computer. Install ${AGENT[agent]}, or choose the other agent in Settings.`,
  notPicture: "This file is not a PNG, JPEG or WebP picture, so it cannot be read.",
  unavailableFile: "The picture could not be fetched, or it is over the size limit.",
  failed: "The agent failed or answered nothing. Try again later.",
  timeout: "The agent gave no answer in time. Try again later.",
  readFailed: "Could not read the picture.",
  openFailed: "Could not open the file.",
}

const ru: typeof en = {
  read: "Прочитать картинку",
  open: "Открыть файл",
  reading: "Агент читает картинку. Это может занять минуту.",
  readBy: (by) => `Прочитал ${by}:`,
  empty: "Агент не нашел текста на этой картинке.",
  off: "Чтение картинок стоит на «Никогда», поэтому ни одна картинка не уходит агенту. Включите его в Настройках.",
  goSetting: "Открыть Чтение картинок",
  unavailable: (agent) =>
    `${AGENT[agent]} не установлен на этом компьютере. Установите ${AGENT[agent]} или выберите другого агента в Настройках.`,
  notPicture: "Этот файл не картинка PNG, JPEG или WebP, его не прочитать.",
  unavailableFile: "Картинку не удалось получить, или она больше допустимого размера.",
  failed: "Агент не справился или ничего не ответил. Попробуйте позже.",
  timeout: "Агент не ответил вовремя. Попробуйте позже.",
  readFailed: "Не удалось прочитать картинку.",
  openFailed: "Не удалось открыть файл.",
}

const es: typeof en = {
  read: "Leer la imagen",
  open: "Abrir el archivo",
  reading: "Tu agente está leyendo la imagen. Puede tardar un minuto.",
  readBy: (by) => `Leído por ${by}:`,
  empty: "El agente no encontró texto en esta imagen.",
  off: "Leer imágenes está en «Nunca», así que ninguna imagen va a un agente. Actívalo en Ajustes.",
  goSetting: "Abrir Leer imágenes",
  unavailable: (agent) =>
    `${AGENT[agent]} no está instalado en este ordenador. Instala ${AGENT[agent]} o elige el otro agente en Ajustes.`,
  notPicture: "Este archivo no es una imagen PNG, JPEG o WebP, así que no se puede leer.",
  unavailableFile: "No se pudo obtener la imagen, o supera el tamaño máximo.",
  failed: "El agente falló o no respondió nada. Inténtalo más tarde.",
  timeout: "El agente no respondió a tiempo. Inténtalo más tarde.",
  readFailed: "No se pudo leer la imagen.",
  openFailed: "No se pudo abrir el archivo.",
}

export const fileActionMessages: Messages<typeof en> = { en, ru, es }
