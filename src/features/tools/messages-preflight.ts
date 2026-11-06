import type { Messages } from "@/i18n"

type Op = "install" | "update"

const en = {
  checking: "Checking that your other tools keep working with your saved messages and notes…",
  title: (op: Op, name: string): string =>
    op === "install" ? `Before you install ${name}` : `Before you update ${name}`,
  cannotOpen: (name: string, own: boolean) =>
    `${name} can't open your saved messages and notes yet: another WireCat tool already moved them to a newer format. ${own ? "A version that can usually comes out within a day." : "Wait for a version that can."}`,
  moves: (op: Op, name: string) =>
    `${op === "install" ? "Installing" : "Updating"} ${name} moves your saved messages and notes to a newer format.`,
  fixed: (tool: string, version: string) => `${tool} ${version} reads it: update it in the same step.`,
  waits: (tool: string, own: boolean) =>
    `${tool} can't use them until its new version comes out${own ? ", usually within a day" : ""}.`,
  both: (op: Op, name: string, others: string) =>
    op === "install" ? `Install ${name}, update ${others}` : `Update ${name} and ${others}`,
  anyway: (op: Op): string => (op === "install" ? "Install anyway" : "Update anyway"),
  notNow: "Not now",
}

export type PreflightText = typeof en

const ru: PreflightText = {
  checking: "Проверяем, что остальные инструменты продолжат работать с сохранёнными сообщениями и заметками…",
  title: (op, name) => (op === "install" ? `Перед установкой ${name}` : `Перед обновлением ${name}`),
  cannotOpen: (name, own) =>
    `${name} пока не может открыть сохранённые сообщения и заметки: другой инструмент WireCat уже перевёл их в новый формат. ${own ? "Версия, которая сможет, обычно выходит в течение дня." : "Дождитесь версии, которая сможет."}`,
  moves: (op, name) =>
    `${op === "install" ? "Установка" : "Обновление"} ${name} переведёт сохранённые сообщения и заметки в новый формат.`,
  fixed: (tool, version) => `${tool} ${version} его читает: обновите его заодно.`,
  waits: (tool, own) =>
    `${tool} не сможет с ними работать, пока не выйдет его новая версия${own ? ", обычно в течение дня" : ""}.`,
  both: (op, name, others) =>
    op === "install" ? `Установить ${name}, обновить ${others}` : `Обновить ${name} и ${others}`,
  anyway: (op) => (op === "install" ? "Всё равно установить" : "Всё равно обновить"),
  notNow: "Не сейчас",
}

const es: PreflightText = {
  checking: "Comprobando que tus otras herramientas sigan funcionando con tus mensajes y notas guardados…",
  title: (op, name) => (op === "install" ? `Antes de instalar ${name}` : `Antes de actualizar ${name}`),
  cannotOpen: (name, own) =>
    `${name} aún no puede abrir tus mensajes y notas guardados: otra herramienta de WireCat ya los pasó a un formato más nuevo. ${own ? "Una versión que pueda suele salir en un día." : "Espera a una versión que pueda."}`,
  moves: (op, name) =>
    `${op === "install" ? "Instalar" : "Actualizar"} ${name} pasa tus mensajes y notas guardados a un formato más nuevo.`,
  fixed: (tool, version) => `${tool} ${version} lo lee: actualízalo en el mismo paso.`,
  waits: (tool, own) =>
    `${tool} no podrá usarlos hasta que salga su nueva versión${own ? ", normalmente en un día" : ""}.`,
  both: (op, name, others) =>
    op === "install" ? `Instalar ${name}, actualizar ${others}` : `Actualizar ${name} y ${others}`,
  anyway: (op) => (op === "install" ? "Instalar de todos modos" : "Actualizar de todos modos"),
  notNow: "Ahora no",
}

export const preflightMessages: Messages<PreflightText> = { en, ru, es }
