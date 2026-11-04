import type { Messages } from "@/i18n"

const en = {
  fix: "Fix",
  panel: "Fix with an AI agent",
  lead: "WireCat writes what went wrong into a prompt and opens your agent with it in a terminal. The agent explains what it finds and asks before it changes anything.",
  open: (agent: string) => `Open ${agent}`,
  opening: "Opening…",
  looking: "Looking for agents…",
  none: "WireCat found no agent it can start here. It can open Claude Code, Codex and Gemini CLI.",
  started: (agent: string) =>
    `${agent} opened in a terminal with the prompt. When it says the problem is fixed, press Try again.`,
  failed: (agent: string) => `Could not start ${agent}.`,
  why: {
    missing: (agent: string, bin: string) =>
      `${agent} is not on this computer's PATH, so WireCat cannot start it. Open a new terminal and run ${bin}: if it is not found, install ${agent} again; if it starts, restart WireCat so it sees the new PATH.`,
    terminal:
      "WireCat could not open a terminal window. Open a terminal yourself, start your agent there and paste the prompt into it.",
    automation:
      "macOS did not let WireCat open Terminal. Allow it in System Settings, Privacy & Security, Automation, under WireCat, then try again. Until then, copy the prompt and paste it into your agent.",
  },
  yourself: "Do it yourself",
  promptLead: "Paste this into any AI agent, or follow it yourself:",
  prompt: "Copy the prompt",
  byHand: "The fix WireCat suggests:",
}

const ru: typeof en = {
  fix: "Исправить",
  panel: "Исправить с помощью ИИ-агента",
  lead: "WireCat опишет, что пошло не так, в промпте и откроет вашего агента с ним в терминале. Агент объяснит, что нашёл, и спросит, прежде чем что-то менять.",
  open: (agent) => `Открыть ${agent}`,
  opening: "Открываем…",
  looking: "Ищем агентов…",
  none: "WireCat не нашёл агента, которого может запустить. Он умеет открывать Claude Code, Codex и Gemini CLI.",
  started: (agent) =>
    `${agent} открыт в терминале с промптом. Когда он скажет, что всё исправлено, нажмите «Попробовать снова».`,
  failed: (agent) => `Не удалось запустить ${agent}.`,
  why: {
    missing: (agent, bin) =>
      `${agent} нет в PATH этого компьютера, поэтому WireCat не может его запустить. Откройте новый терминал и выполните ${bin}: если команда не найдена, установите ${agent} заново; если запустился — перезапустите WireCat, чтобы он увидел новый PATH.`,
    terminal:
      "WireCat не смог открыть окно терминала. Откройте терминал сами, запустите там агента и вставьте в него промпт.",
    automation:
      "macOS не разрешил WireCat открыть Терминал. Разрешите в Системных настройках: Конфиденциальность и безопасность, Автоматизация, WireCat — и попробуйте снова. А пока скопируйте промпт и вставьте его в своего агента.",
  },
  yourself: "Сделать самому",
  promptLead: "Вставьте это в любого ИИ-агента или выполните сами:",
  prompt: "Скопировать промпт",
  byHand: "Что советует WireCat:",
}

const es: typeof en = {
  fix: "Arreglar",
  panel: "Arreglar con un agente de IA",
  lead: "WireCat describe lo que falló en un prompt y abre tu agente con él en un terminal. El agente explica lo que encuentra y pregunta antes de cambiar nada.",
  open: (agent) => `Abrir ${agent}`,
  opening: "Abriendo…",
  looking: "Buscando agentes…",
  none: "WireCat no encontró ningún agente que pueda iniciar aquí. Puede abrir Claude Code, Codex y Gemini CLI.",
  started: (agent) =>
    `${agent} se abrió en un terminal con el prompt. Cuando diga que está arreglado, pulsa Reintentar.`,
  failed: (agent) => `No se pudo iniciar ${agent}.`,
  why: {
    missing: (agent, bin) =>
      `${agent} no está en el PATH de este equipo, así que WireCat no puede iniciarlo. Abre un terminal nuevo y ejecuta ${bin}: si no se encuentra, instala ${agent} de nuevo; si arranca, reinicia WireCat para que vea el PATH nuevo.`,
    terminal:
      "WireCat no pudo abrir una ventana de terminal. Abre un terminal tú mismo, inicia allí tu agente y pega en él el prompt.",
    automation:
      "macOS no dejó que WireCat abriera Terminal. Permítelo en Ajustes del Sistema, Privacidad y seguridad, Automatización, en WireCat, y vuelve a intentarlo. Mientras tanto, copia el prompt y pégalo en tu agente.",
  },
  yourself: "Hacerlo tú mismo",
  promptLead: "Pega esto en cualquier agente de IA o síguelo tú mismo:",
  prompt: "Copiar el prompt",
  byHand: "El arreglo que sugiere WireCat:",
}

export const fixMessages: Messages<typeof en> = { en, ru, es }
