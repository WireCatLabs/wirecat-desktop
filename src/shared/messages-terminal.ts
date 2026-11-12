import type { Messages } from "@/i18n"

/** Why a terminal the app tried to open did not open, by the `reason` Rust gives, as `AgentRunNote` words an agent's. */
const en = {
  terminal: "WireCat could not open a terminal window. Copy the command and run it in a terminal yourself.",
  automation:
    "macOS did not let WireCat open Terminal. Allow it in System Settings, Privacy & Security, Automation, under WireCat, then try again. Until then, copy the command and run it yourself.",
}

const ru: typeof en = {
  terminal: "WireCat не смог открыть окно терминала. Скопируйте команду и выполните её в терминале сами.",
  automation:
    "macOS не разрешил WireCat открыть Терминал. Разрешите в Системных настройках: Конфиденциальность и безопасность, Автоматизация, WireCat — и попробуйте снова. А пока скопируйте команду и выполните её сами.",
}

const es: typeof en = {
  terminal: "WireCat no pudo abrir una ventana de terminal. Copia el comando y ejecútalo tú en un terminal.",
  automation:
    "macOS no dejó que WireCat abriera Terminal. Permítelo en Ajustes del Sistema, Privacidad y seguridad, Automatización, en WireCat, y vuelve a intentarlo. Mientras tanto, copia el comando y ejecútalo tú.",
}

export const terminalMessages: Messages<typeof en> = { en, ru, es }
