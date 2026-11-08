import type { DeepLinkTarget } from "@/domain/links"
import type { Messages } from "@/i18n"

type Kind = DeepLinkTarget["type"]

const en = {
  refusedTitle: "WireCat can't open this link",
  refusedBody:
    "It is not a WireCat link, or it comes from a newer version of WireCat, or part of it was lost when it was copied. Nothing was done.",
  unsupportedTitle: "This can't open in WireCat yet",
  unsupportedBody: (what: string) =>
    `WireCat has no page for ${what} yet. Copy the reference to give it to your AI agent, or come back after an update.`,
  missingTitle: "This item is not on this computer",
  missingBody: (what: string) =>
    `WireCat could not find ${what} here. It may be deleted, or not synced to this computer yet.`,
  reference: "Reference",
  copyReference: "Copy the reference",
  back: "Back",
  kinds: {
    message: "this message",
    chat: "this chat",
    task: "this task",
    tasks: "this task list",
    proposal: "this proposal",
    digest: "this digest",
    person: "this person",
    project: "this project",
    sync: "this tool's sync",
  } satisfies Record<Kind, string>,
}

const ru: typeof en = {
  refusedTitle: "WireCat не может открыть эту ссылку",
  refusedBody:
    "Это не ссылка WireCat, или она из более новой версии WireCat, или часть её потерялась при копировании. Ничего не сделано.",
  unsupportedTitle: "Это пока нельзя открыть в WireCat",
  unsupportedBody: (what) =>
    `В WireCat пока нет страницы, которая показывает ${what}. Скопируйте ссылку на объект, чтобы передать её AI-агенту, или вернитесь после обновления.`,
  missingTitle: "Этого нет на этом компьютере",
  missingBody: (what) =>
    `WireCat не нашёл здесь ${what}. Возможно, его удалили или ещё не синхронизировали на этот компьютер.`,
  reference: "Ссылка на объект",
  copyReference: "Скопировать ссылку на объект",
  back: "Назад",
  kinds: {
    message: "это сообщение",
    chat: "этот чат",
    task: "эту задачу",
    tasks: "этот список задач",
    proposal: "это предложение",
    digest: "эту сводку",
    person: "этого человека",
    project: "этот проект",
    sync: "синхронизацию этого инструмента",
  },
}

const es: typeof en = {
  refusedTitle: "WireCat no puede abrir este enlace",
  refusedBody:
    "No es un enlace de WireCat, viene de una versión más nueva de WireCat o se perdió una parte al copiarlo. No se hizo nada.",
  unsupportedTitle: "Esto aún no se puede abrir en WireCat",
  unsupportedBody: (what) =>
    `WireCat aún no tiene una página para ${what}. Copia la referencia para dársela a tu agente de IA, o vuelve después de una actualización.`,
  missingTitle: "Esto no está en este ordenador",
  missingBody: (what) =>
    `WireCat no encontró aquí ${what}. Puede que se haya borrado o que aún no se haya sincronizado en este ordenador.`,
  reference: "Referencia",
  copyReference: "Copiar la referencia",
  back: "Atrás",
  kinds: {
    message: "este mensaje",
    chat: "este chat",
    task: "esta tarea",
    tasks: "esta lista de tareas",
    proposal: "esta propuesta",
    digest: "este resumen",
    person: "esta persona",
    project: "este proyecto",
    sync: "la sincronización de esta herramienta",
  },
}

export const linkMessages: Messages<typeof en> = { en, ru, es }
