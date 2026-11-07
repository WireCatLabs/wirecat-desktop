import type { Messages } from "@/i18n"

const en = {
  kept: "This folder existed before WireCat added the tool, so WireCat leaves it alone:",
}

const ru: typeof en = {
  kept: "Эта папка была до того, как WireCat добавил инструмент, поэтому WireCat её не трогает:",
}

const es: typeof en = {
  kept: "Esta carpeta ya existía antes de que WireCat añadiera la herramienta, así que WireCat no la toca:",
}

export const keptMessages: Messages<typeof en> = { en, ru, es }
