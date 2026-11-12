import type { Messages } from "@/i18n"

/** The doubt about the owner's own card: one of the owner's accounts has another name, which is often fine. */
const en = {
  ownerReason: "One of the accounts on your own card has another name, for example your bot or a shared mailbox.",
  ownerHelp: (keep: string, split: string) =>
    `«${keep}»: it stays yours, its messages count as yours in search and digests, and you are not asked again. «${split}»: it becomes a contact of its own.`,
}

const ru: typeof en = {
  ownerReason: "У одного из аккаунтов на вашей карточке другое имя, например это ваш бот или общий ящик.",
  ownerHelp: (keep, split) =>
    `«${keep}»: аккаунт остается вашим, его сообщения считаются вашими в поиске и сводках, и WireCat больше не спросит. «${split}»: аккаунт станет отдельным контактом.`,
}

const es: typeof en = {
  ownerReason: "Una de las cuentas de tu propia ficha tiene otro nombre, por ejemplo tu bot o un buzón compartido.",
  ownerHelp: (keep, split) =>
    `«${keep}»: sigue siendo tuya, sus mensajes cuentan como tuyos en la búsqueda y los resúmenes, y no se vuelve a preguntar. «${split}»: pasa a ser un contacto propio.`,
}

export const doubtMessages: Messages<typeof en> = { en, ru, es }
