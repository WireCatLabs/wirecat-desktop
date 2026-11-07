import type { Lang } from "@/i18n"

// cli-docs builds each heading's anchor from its translated text, so ru and es need their own; they match the
// headings "Добавить свой инструмент" and "Añadir tu propia herramienta" on the docs page.
const ANCHOR: Record<Lang, string> = {
  en: "add-your-own-tool",
  ru: "добавить-свой-инструмент",
  es: "añadir-tu-propia-herramienta",
}

export const ownToolsDocs = (lang: Lang) => `https://wirecat.dev/${lang}/docs/desktop#${ANCHOR[lang]}`
