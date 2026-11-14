import type { Messages } from "@/i18n"

const en = {
  heading: "Chat agents",
  label: "Connect chat agents read only",
  risk: "Anyone who can message the agent's bot can ask it to send, change or delete with your accounts.",
  onNext: "Agents connected before keep the levels they have now. Connect them again to set their profiles read only.",
  offNow:
    "Profiles already set read only stay read only. WireCat did not keep the levels they had before, so change them in each tool's Permissions on the Tools page.",
}

const ru: typeof en = {
  heading: "Чат-агенты",
  label: "Подключать чат-агентов только для чтения",
  risk: "Любой, кто может написать боту агента, может попросить его отправить, изменить или удалить что-то от имени ваших аккаунтов.",
  onNext:
    "Уже подключённые агенты сохраняют свои нынешние уровни. Подключите их заново, чтобы их профили стали только для чтения.",
  offNow:
    "Профили, которые уже только для чтения, такими и останутся. WireCat не сохранил их прежние уровни, поэтому измените их в разрешениях каждого инструмента на странице «Инструменты».",
}

const es: typeof en = {
  heading: "Agentes de chat",
  label: "Conectar los agentes de chat en solo lectura",
  risk: "Cualquiera que pueda escribir al bot del agente puede pedirle que envíe, cambie o borre con tus cuentas.",
  onNext:
    "Los agentes ya conectados mantienen los niveles que tienen ahora. Vuelve a conectarlos para poner sus perfiles en solo lectura.",
  offNow:
    "Los perfiles que ya están en solo lectura siguen así. WireCat no guardó los niveles que tenían antes, así que cámbialos en los Permisos de cada herramienta, en la página Herramientas.",
}

export const chatLimitMessages: Messages<typeof en> = { en, ru, es }
