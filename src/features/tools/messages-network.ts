import type { Messages } from "@/i18n"

const en = {
  heading: "Where its data goes",
  hosts: "The servers it says it contacts:",
  none: "It says it contacts no server of its own.",
  userHosts: (text: string) => `Also a server you choose: ${text}.`,
  undeclared: "This version does not say which servers it contacts.",
}

const ru: typeof en = {
  heading: "Куда уходят данные",
  hosts: "Серверы, с которыми он, по его словам, связывается:",
  none: "По его словам, он не связывается ни с одним своим сервером.",
  userHosts: (text) => `А также с сервером, который выбираете вы: ${text}.`,
  undeclared: "Эта версия не говорит, с какими серверами связывается.",
}

const es: typeof en = {
  heading: "Adónde van sus datos",
  hosts: "Los servidores con los que dice conectarse:",
  none: "Dice que no se conecta a ningún servidor propio.",
  userHosts: (text) => `También un servidor que eliges tú: ${text}.`,
  undeclared: "Esta versión no dice con qué servidores se conecta.",
}

export const networkMessages: Messages<typeof en> = { en, ru, es }
