export const TEMPLATE_CHANNELS = ["telegram", "email", "text"] as const
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number]

/** The languages memo ships the digest's templates in. */
export const TEMPLATE_LOCALES = ["ru", "en"] as const
export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number]

/** memo's own count: it trims the brief before it measures and saves it. */
export const briefChars = (text: string) => text.trim().length

export const localeFor = (lang: string): TemplateLocale => (lang === "ru" ? "ru" : "en")
