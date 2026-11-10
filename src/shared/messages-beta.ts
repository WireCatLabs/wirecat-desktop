import type { Messages } from "@/i18n"

const en = { label: "Beta: this section is new and lightly tested" }
const ru: typeof en = { label: "Бета: раздел новый и мало проверен" }
const es: typeof en = { label: "Beta: esta sección es nueva y está poco probada" }

export const betaMessages: Messages<typeof en> = { en, ru, es }
