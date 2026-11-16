import { type Messages, plural } from "@/i18n"

/** Agents' joins and why a match waits: memo merges for an agent only on strong evidence it finds itself. */
const en = {
  agentMergesTitle: "Joined by an agent",
  agentMergesIntro:
    "An agent joined these people itself, because WireCat found one personal mobile number or address that only they have, in two different sources. Undo a join if it is wrong.",
  agentMergedN: (n: number) => plural("en", n, { one: "An agent joined # person", other: "Agents joined # people" }),
  agentMergedHelp:
    "Each was joined on a mobile number or address only they have. Check them and undo any that is wrong.",
  agentMergedToo: (n: number) =>
    plural("en", n, { one: "An agent also joined # person.", other: "Agents also joined # people." }),
  agentMergesMore: "Agents joined more people than shown here.",
  agentMergedBy: (name: string) => `by ${name}`,
  agentMergedTip: (name: string) => `The agent ${name} joined them, and recorded why.`,
  factNamesStrength: { phone: "Phone", email: "Address" } as Record<string, string>,
  notStrong: (why: string) => `Not joined on its own: ${why}`,
  weakNames: {
    landline: "the number is an office landline",
    shared: "more people have it",
    company: "it is a company's line or mailbox",
    "role-address": "it is a role address such as info@",
    "no-reply": "it is a no-reply address",
    "one-source": "only one source gives it",
    "not-own-number": "only a CRM or a card gives the number",
    "nothing-shared": "they share no phone or address",
    owner: "one of them is you",
    rejected: "you turned this pair down before",
    "propose-only": "your settings let agents only suggest",
  } as Record<string, string>,
}

const ru: typeof en = {
  agentMergesTitle: "Объединил агент",
  agentMergesIntro:
    "Агент объединил этих людей сам: WireCat нашёл личный мобильный номер или адрес, который есть только у них, в двух разных источниках. Если объединение неверное, отмените его.",
  agentMergedN: (n: number) =>
    plural("ru", n, {
      one: "Агенты объединили # человека",
      few: "Агенты объединили # человек",
      many: "Агенты объединили # человек",
      other: "Агенты объединили # человека",
    }),
  agentMergedHelp:
    "Каждого объединили по мобильному номеру или адресу, который есть только у них. Проверьте и отмените неверные.",
  agentMergedToo: (n: number) => `Ещё агенты объединили людей: ${n}.`,
  agentMergesMore: "Агенты объединили больше людей, чем показано здесь.",
  agentMergedBy: (name: string) => `агент ${name}`,
  agentMergedTip: (name: string) => `Их объединил агент ${name} и записал почему.`,
  factNamesStrength: { phone: "Телефон", email: "Адрес" },
  notStrong: (why: string) => `Сам WireCat не объединил: ${why}`,
  weakNames: {
    landline: "это городской номер офиса",
    shared: "он есть у других людей",
    company: "это линия или ящик компании",
    "role-address": "это общий адрес вроде info@",
    "no-reply": "это адрес no-reply",
    "one-source": "его даёт только один источник",
    "not-own-number": "номер есть только в CRM или визитке",
    "nothing-shared": "у них нет общего телефона или адреса",
    owner: "один из них это вы",
    rejected: "вы уже отклоняли эту пару",
    "propose-only": "в настройках агентам можно только предлагать",
  },
}

const es: typeof en = {
  agentMergesTitle: "Unidas por un agente",
  agentMergesIntro:
    "Un agente unió a estas personas por sí mismo, porque WireCat encontró un móvil o una dirección personal que solo ellas tienen, en dos fuentes distintas. Deshaz la unión si es un error.",
  agentMergedN: (n: number) =>
    plural("es", n, { one: "Un agente unió a # persona", other: "Los agentes unieron a # personas" }),
  agentMergedHelp:
    "Cada una se unió por un móvil o una dirección que solo ellas tienen. Revísalas y deshaz las que estén mal.",
  agentMergedToo: (n: number) =>
    plural("es", n, { one: "Un agente también unió a # persona.", other: "Los agentes también unieron a # personas." }),
  agentMergesMore: "Los agentes unieron a más personas de las que se ven aquí.",
  agentMergedBy: (name: string) => `por ${name}`,
  agentMergedTip: (name: string) => `El agente ${name} las unió y anotó por qué.`,
  factNamesStrength: { phone: "Teléfono", email: "Dirección" },
  notStrong: (why: string) => `WireCat no las unió por sí solo: ${why}`,
  weakNames: {
    landline: "el número es un fijo de oficina",
    shared: "más personas lo tienen",
    company: "es una línea o un buzón de empresa",
    "role-address": "es una dirección de rol como info@",
    "no-reply": "es una dirección no-reply",
    "one-source": "solo una fuente lo da",
    "not-own-number": "solo un CRM o una tarjeta da el número",
    "nothing-shared": "no comparten teléfono ni dirección",
    owner: "una de ellas eres tú",
    rejected: "ya rechazaste esta pareja",
    "propose-only": "tu configuración solo deja proponer a los agentes",
  },
}

export const agentMessages: Messages<typeof en> = { en, ru, es }
