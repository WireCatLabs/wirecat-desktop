import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

// The recommended model is named only by this label; its one word "model" links to the model's own terms.
const en = {
  best: (model: ReactNode): ReactNode => <>Best local {model}</>,
  modelWord: "model",
}

const ru: typeof en = {
  best: (model) => <>Оптимальная локальная {model}</>,
  modelWord: "модель",
}

const es: typeof en = {
  best: (model) => <>Mejor {model} local</>,
  modelWord: "modelo",
}

export const searchModelMessages: Messages<typeof en> = { en, ru, es }
