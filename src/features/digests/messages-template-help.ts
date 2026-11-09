import type { Messages } from "@/i18n"

/** The values memo's digest templates get: cli-core's `ReportView` (background/report/view.d.ts), as memo 0.131.75 ships it. */
export const TEMPLATE_VARS = [
  "date.date",
  "date.weekday",
  "summary",
  "quiet",
  "sections",
  "section.kind",
  "section.items",
  "section.more",
  "item.type",
  "item.who",
  "item.topic",
  "item.action",
  "item.detail",
  "item.due",
  "item.links",
  "health.items",
  "scope.window",
  "emoji",
] as const
export type TemplateVar = (typeof TEMPLATE_VARS)[number]

export const TEMPLATE_EXAMPLE = `{{ emoji }} {{ date.date }}
{%- if summary %}
{{ summary }}
{%- endif %}
{%- for section in sections %}

{{ section.emoji }} {{ section.items.size }}
{%- for item in section.items %}
• {{ item.topic }}{% if item.who %} · {{ item.who }}{% endif %}
{%- endfor %}
{%- if section.more > 0 %}
+ {{ section.more }}
{%- endif %}
{%- endfor %}`

const en = {
  open: "How templates work",
  title: "Digest templates",
  what: "A template decides how the digest looks where it goes: in Telegram, in an email and as plain text (the terminal and the notification). The agent decides what the digest says; the template only lays it out.",
  liquid:
    "Templates are written in Liquid, a small template language. {{ summary }} prints a value. {% if summary %} … {% endif %} shows a part only when there is a value. {% for item in section.items %} … {% endfor %} repeats a part for each item.",
  builtIn:
    "Memo has a built-in template for each channel, in English and Russian. Your own template replaces it for this digest, this channel and this language only. Reset brings the built-in one back.",
  check:
    "Preview shows your draft with the last real digest, or with a sample when there is none yet. Memo checks a template before it saves it, and says what is wrong.",
  varsTitle: "What a template can use",
  vars: {
    "date.date": "the digest's day, in your language",
    "date.weekday": "the day of the week: 1 is Monday, 7 is Sunday",
    summary: "the agent's one-line summary, or nothing",
    quiet: "true when every section is empty",
    sections: "the sections in their fixed order, each with an emoji",
    "section.kind": "today, decisions, money, meetings, projects or mail",
    "section.items": "the items of a section",
    "section.more": "how many items were left out",
    "item.type": "reply, question, task, fact, risk, money, decision or meeting",
    "item.who": "the person, or nothing",
    "item.topic": "what it is about",
    "item.action": "what to do",
    "item.detail": "more about it",
    "item.due": "when it is due: .date, .time, .span (how far from now)",
    "item.links": "links to open the source: each has .url and .label",
    "health.items": "accounts whose sync needs attention: .source, .account, .span",
    "scope.window": "the time the digest covers, such as 24 h",
    emoji: "the digest's emoji",
  } satisfies Record<TemplateVar, string>,
  safety:
    "Text the agent wrote is already made safe for the email's HTML. A link in an email may point only at one of the digest's own links.",
  exampleTitle: "A short example",
}

const ru: typeof en = {
  open: "Как устроены шаблоны",
  title: "Шаблоны сводки",
  what: "Шаблон задает, как сводка выглядит там, куда она уходит: в Telegram, в письме и простым текстом (в терминале и в уведомлении). Что написать в сводке, решает агент. Шаблон только раскладывает это по местам.",
  liquid:
    "Шаблоны пишутся на Liquid, это небольшой язык шаблонов. {{ summary }} выводит значение. {% if summary %} … {% endif %} показывает часть, только когда значение есть. {% for item in section.items %} … {% endfor %} повторяет часть для каждого пункта.",
  builtIn:
    "В Memo есть встроенный шаблон для каждого канала, на английском и русском. Ваш шаблон заменяет его только для этой сводки, этого канала и этого языка. Кнопка сброса возвращает встроенный.",
  check:
    "Предпросмотр показывает черновик на последней настоящей сводке, а если ее еще нет, на примере. Memo проверяет шаблон перед сохранением и говорит, что не так.",
  varsTitle: "Что можно использовать в шаблоне",
  vars: {
    "date.date": "день сводки, на вашем языке",
    "date.weekday": "день недели: 1 это понедельник, 7 воскресенье",
    summary: "итог агента в одну строку, или пусто",
    quiet: "true, когда все разделы пусты",
    sections: "разделы в постоянном порядке, у каждого свой эмодзи",
    "section.kind": "today, decisions, money, meetings, projects или mail",
    "section.items": "пункты раздела",
    "section.more": "сколько пунктов не вошло",
    "item.type": "reply, question, task, fact, risk, money, decision или meeting",
    "item.who": "человек, или пусто",
    "item.topic": "о чем пункт",
    "item.action": "что сделать",
    "item.detail": "подробности",
    "item.due": "срок: .date, .time, .span (сколько осталось или прошло)",
    "item.links": "ссылки на источник: у каждой есть .url и .label",
    "health.items": "аккаунты, синхронизация которых требует внимания: .source, .account, .span",
    "scope.window": "за какое время сводка, например 24 ч",
    emoji: "эмодзи сводки",
  },
  safety:
    "Текст агента уже подготовлен для HTML письма. Ссылка в письме может вести только на одну из ссылок самой сводки.",
  exampleTitle: "Короткий пример",
}

const es: typeof en = {
  open: "Cómo funcionan las plantillas",
  title: "Plantillas del resumen",
  what: "Una plantilla decide cómo se ve el resumen allí donde llega: en Telegram, en un correo y como texto simple (la terminal y la notificación). Lo que dice el resumen lo decide el agente; la plantilla solo lo ordena.",
  liquid:
    "Las plantillas se escriben en Liquid, un lenguaje de plantillas pequeño. {{ summary }} muestra un valor. {% if summary %} … {% endif %} muestra una parte solo cuando hay valor. {% for item in section.items %} … {% endfor %} repite una parte para cada elemento.",
  builtIn:
    "Memo trae una plantilla para cada canal, en inglés y en ruso. La tuya la sustituye solo para este resumen, este canal y este idioma. Restablecer vuelve a la de Memo.",
  check:
    "La vista previa muestra tu borrador con el último resumen real, o con un ejemplo si aún no hay ninguno. Memo comprueba la plantilla antes de guardarla y dice qué falla.",
  varsTitle: "Qué puede usar una plantilla",
  vars: {
    "date.date": "el día del resumen, en tu idioma",
    "date.weekday": "el día de la semana: 1 es lunes, 7 es domingo",
    summary: "el resumen del agente en una línea, o nada",
    quiet: "true cuando todas las secciones están vacías",
    sections: "las secciones en su orden fijo, cada una con su emoji",
    "section.kind": "today, decisions, money, meetings, projects o mail",
    "section.items": "los elementos de una sección",
    "section.more": "cuántos elementos se quedaron fuera",
    "item.type": "reply, question, task, fact, risk, money, decision o meeting",
    "item.who": "la persona, o nada",
    "item.topic": "de qué trata",
    "item.action": "qué hacer",
    "item.detail": "más detalle",
    "item.due": "cuándo vence: .date, .time, .span (cuánto falta o pasó)",
    "item.links": "enlaces a la fuente: cada uno tiene .url y .label",
    "health.items": "cuentas cuya sincronización necesita atención: .source, .account, .span",
    "scope.window": "el tiempo que cubre el resumen, como 24 h",
    emoji: "el emoji del resumen",
  },
  safety:
    "El texto del agente ya está preparado para el HTML del correo. Un enlace en un correo solo puede apuntar a uno de los enlaces del propio resumen.",
  exampleTitle: "Un ejemplo corto",
}

export const templateHelpMessages: Messages<typeof en> = { en, ru, es }
