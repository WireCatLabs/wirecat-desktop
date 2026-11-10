import type { Messages } from "@/i18n"

const en = {
  openHost: (host: string) => `Open ${host}`,
  copyLink: (host: string) => `Copy the link to ${host}`,
  menu: "Link",
  copyAddress: "Copy link address",
  copiedAddress: "Link address copied",
  copyFailed: "Could not copy. Select the address and copy it by hand:",
}

const ru: typeof en = {
  openHost: (host) => `Открыть ${host}`,
  copyLink: (host) => `Скопировать ссылку на ${host}`,
  menu: "Ссылка",
  copyAddress: "Скопировать адрес ссылки",
  copiedAddress: "Адрес ссылки скопирован",
  copyFailed: "Не получилось скопировать. Выделите адрес и скопируйте его вручную:",
}

const es: typeof en = {
  openHost: (host) => `Abrir ${host}`,
  copyLink: (host) => `Copiar el enlace a ${host}`,
  menu: "Enlace",
  copyAddress: "Copiar la dirección del enlace",
  copiedAddress: "Dirección del enlace copiada",
  copyFailed: "No se pudo copiar. Selecciona la dirección y cópiala a mano:",
}

export const linkMessages: Messages<typeof en> = { en, ru, es }
