import type { Messages } from "@/i18n"

const or = (items: readonly string[], lang: string) => new Intl.ListFormat(lang, { type: "disjunction" }).format(items)

const en = {
  missing: (tool: string) => `This page reads ${tool}, which is not installed.`,
  others: (tools: readonly string[]) => `${or(tools, "en")} would do as well.`,
  old: (tool: string, version: string | null, need: string) =>
    `This page needs ${tool} ${need} or newer; this computer has ${version ?? "an older one"}.`,
  newer: (tool: string, version: string | null) =>
    `This page needs a newer ${tool} than ${version ?? "the one on this computer"}.`,
  signedOut: (tool: string) => `Sign in to ${tool} so this page can read your account.`,
  install: (tool: string) => `Install ${tool}`,
  update: (tool: string) => `Update ${tool}`,
  signIn: (tool: string) => `Sign in to ${tool}`,
}

const ru: typeof en = {
  missing: (tool) => `Этой странице нужен ${tool}, а он не установлен.`,
  others: (tools) => `Подойдет и ${or(tools, "ru")}.`,
  old: (tool, version, need) =>
    `Этой странице нужен ${tool} ${need} или новее. На этом компьютере ${version ?? "версия старше"}.`,
  newer: (tool, version) => `Этой странице нужен ${tool} новее, чем ${version ?? "на этом компьютере"}.`,
  signedOut: (tool) => `Войдите в ${tool}, чтобы эта страница видела ваш аккаунт.`,
  install: (tool) => `Установить ${tool}`,
  update: (tool) => `Обновить ${tool}`,
  signIn: (tool) => `Войти в ${tool}`,
}

const es: typeof en = {
  missing: (tool) => `Esta página necesita ${tool}, que no está instalado.`,
  others: (tools) => `También sirve ${or(tools, "es")}.`,
  old: (tool, version, need) =>
    `Esta página necesita ${tool} ${need} o posterior; este equipo tiene ${version ?? "una anterior"}.`,
  newer: (tool, version) => `Esta página necesita un ${tool} más nuevo que ${version ?? "el de este equipo"}.`,
  signedOut: (tool) => `Inicia sesión en ${tool} para que esta página lea tu cuenta.`,
  install: (tool) => `Instalar ${tool}`,
  update: (tool) => `Actualizar ${tool}`,
  signIn: (tool) => `Iniciar sesión en ${tool}`,
}

export const needsMessages: Messages<typeof en> = { en, ru, es }
