import type { Lang } from "@/i18n"

// cli-docs builds each heading's anchor from its translated text.
const ANCHOR: Record<Lang, string> = {
  en: "community-tools",
  ru: "инструменты-сообщества",
  es: "herramientas-de-la-comunidad",
}

export const communityToolsDocs = (lang: Lang) => `https://wirecat.dev/${lang}/docs/desktop#${ANCHOR[lang]}`
