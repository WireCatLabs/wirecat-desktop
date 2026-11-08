import type { Standing } from "@/domain/relationships"
import type { Messages } from "@/i18n"

const en = {
  standing: {
    proposed: "Proposed",
    confirmed: "Confirmed",
    reported: "Reported",
    ended: "Ended",
  } satisfies Record<Standing, string>,
  why: {
    proposed: "An agent proposed it; it waits for your decision.",
    confirmed: "You wrote or confirmed it.",
    reported: "A connected source, such as a CRM, says so; nobody confirmed it.",
    ended: "It held once and no longer does.",
  } satisfies Record<Standing, string>,
}

const ru: typeof en = {
  standing: { proposed: "Предложено", confirmed: "Подтверждено", reported: "Из источника", ended: "Завершено" },
  why: {
    proposed: "Это предложил агент; ждёт вашего решения.",
    confirmed: "Это записали или подтвердили вы.",
    reported: "Так говорит подключённый источник, например CRM; никто это не подтверждал.",
    ended: "Это было верно раньше, но больше не действует.",
  },
}

const es: typeof en = {
  standing: { proposed: "Propuesta", confirmed: "Confirmada", reported: "De una fuente", ended: "Terminada" },
  why: {
    proposed: "La propuso un agente; espera tu decisión.",
    confirmed: "La escribiste o confirmaste tú.",
    reported: "Lo dice una fuente conectada, como un CRM; nadie la confirmó.",
    ended: "Fue cierta y ya no lo es.",
  },
}

export const standingMessages: Messages<typeof en> = { en, ru, es }
