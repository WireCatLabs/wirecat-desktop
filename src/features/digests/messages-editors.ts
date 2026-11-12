import type { TemplateChannel } from "@/domain/digest-editors"
import type { Messages } from "@/i18n"

export type BriefKind = "daily" | "weekly" | "own"

const en = {
  readFailed: "Could not read it.",
  saving: "Saving…",
  undo: "Undo last change",
  unchanged: "Nothing is changed yet.",
  brief: {
    title: "What to collect",
    hint: "Your own instructions for this digest: projects, people, topics, what to skip, how many items. They add to the built-in instructions, and where the two differ, yours win.",
    label: "Your instructions for this digest",
    placeholder: "For example: projects HRB and the warehouse first; skip newsletters; at most five items a section.",
    counter: (chars: number, limit: number) => `${chars} / ${limit}`,
    tooLong: (limit: number) => `At most ${limit} characters: every run reads them and pays for them.`,
    empty: "Write what to collect first.",
    save: "Save",
    remove: "Remove",
    none: "No instructions yet: the digest follows the built-in ones alone.",
    unsupported: "Your instructions cannot be kept yet. Update Memo on the Tools page to write them.",
    failed: (message: string) => `Not saved: ${message}`,
    template: {
      daily:
        "Put first: replies people are waiting for from me, and tasks due today.\nProjects that matter most: \nPeople that matter most: \nSkip: newsletters, service notifications and bots.\nAt most five items a section.",
      weekly:
        "The week on one page: what moved in each project, decisions still waiting for me, payments and invoices.\nProjects that matter most: \nSkip: newsletters, service notifications and small talk.\nAt most five items a section.",
      own: "Collect: \nPut first: \nSkip: newsletters and service notifications.\nAt most five items a section.",
    } satisfies Record<BriefKind, string>,
  },
  templates: {
    empty: "The template is empty. Write it before you save.",
    title: "How it looks",
    hint: "This digest's template for each channel and language, in Liquid. A change is checked before it is saved.",
    channel: "Channel",
    language: "Language",
    channels: { telegram: "Telegram", email: "Email", text: "Plain text" } satisfies Record<TemplateChannel, string>,
    body: "Template",
    own: "Your own template",
    shipped: "The built-in template",
    preview: "Preview",
    previewing: "Building the preview…",
    previewTitle: "What would be sent",
    previewSample: "Rendered from a sample digest: there is no real one yet.",
    previewLast: "Rendered from your last digest.",
    problems: "This cannot be saved:",
    save: "Save",
    reset: "Reset to default",
    unsupported: "The digest's templates cannot be changed yet. Update Memo on the Tools page to edit them.",
    failed: (message: string) => `Not saved: ${message}`,
    previewFailed: "Could not show a preview.",
  },
}

const ru: typeof en = {
  readFailed: "Не удалось прочитать.",
  saving: "Сохраняю…",
  undo: "Отменить последнее изменение",
  unchanged: "Пока ничего не изменено.",
  brief: {
    title: "Что собирать",
    hint: "Ваши указания для этой сводки: проекты, люди, темы, что пропускать, сколько пунктов. Они дополняют встроенные указания, а где расходятся с ними, побеждают ваши.",
    label: "Ваши указания для этой сводки",
    placeholder: "Например: сначала проекты HRB и склад; рассылки пропускать; не больше пяти пунктов в разделе.",
    counter: (chars, limit) => `${chars} / ${limit}`,
    tooLong: (limit) => `Не больше ${limit} знаков: каждый запуск читает их и платит за них.`,
    empty: "Сначала напишите, что собирать.",
    save: "Сохранить",
    remove: "Удалить",
    none: "Указаний пока нет: сводка следует только встроенным.",
    unsupported: "Ваши указания пока нельзя сохранить. Обновите Memo на странице «Инструменты», чтобы их написать.",
    failed: (message) => `Не сохранено: ${message}`,
    template: {
      daily:
        "Сначала: ответы, которых от меня ждут, и задачи со сроком сегодня.\nВажные проекты: \nВажные люди: \nПропускать: рассылки, уведомления сервисов и ботов.\nНе больше пяти пунктов в разделе.",
      weekly:
        "Неделя на одной странице: что сдвинулось в каждом проекте, какие решения еще ждут меня, платежи и счета.\nВажные проекты: \nПропускать: рассылки, уведомления сервисов и пустые разговоры.\nНе больше пяти пунктов в разделе.",
      own: "Собирать: \nСначала: \nПропускать: рассылки и уведомления сервисов.\nНе больше пяти пунктов в разделе.",
    },
  },
  templates: {
    empty: "Шаблон пуст. Напишите его, прежде чем сохранять.",
    title: "Как выглядит",
    hint: "Шаблон этой сводки для каждого канала и языка, на Liquid. Изменение проверяется перед сохранением.",
    channel: "Канал",
    language: "Язык",
    channels: { telegram: "Telegram", email: "Почта", text: "Простой текст" },
    body: "Шаблон",
    own: "Ваш шаблон",
    shipped: "Встроенный шаблон",
    preview: "Предпросмотр",
    previewing: "Готовлю предпросмотр…",
    previewTitle: "Что будет отправлено",
    previewSample: "Показано на примере сводки: настоящей ещё нет.",
    previewLast: "Показано на вашей последней сводке.",
    problems: "Это нельзя сохранить:",
    save: "Сохранить",
    reset: "Вернуть по умолчанию",
    unsupported: "Шаблоны сводки пока нельзя менять. Обновите Memo на странице «Инструменты», чтобы их править.",
    failed: (message) => `Не сохранено: ${message}`,
    previewFailed: "Не удалось показать предпросмотр.",
  },
}

const es: typeof en = {
  readFailed: "No se pudo leer.",
  saving: "Guardando…",
  undo: "Deshacer el último cambio",
  unchanged: "Aún no has cambiado nada.",
  brief: {
    title: "Qué recoger",
    hint: "Tus propias instrucciones para este resumen: proyectos, personas, temas, qué omitir, cuántos puntos. Se suman a las instrucciones integradas y, donde difieren, ganan las tuyas.",
    label: "Tus instrucciones para este resumen",
    placeholder:
      "Por ejemplo: primero los proyectos HRB y el almacén; omite los boletines; como mucho cinco puntos por sección.",
    counter: (chars, limit) => `${chars} / ${limit}`,
    tooLong: (limit) => `Como mucho ${limit} caracteres: cada ejecución los lee y paga por ellos.`,
    empty: "Escribe primero qué recopilar.",
    save: "Guardar",
    remove: "Quitar",
    none: "Aún no hay instrucciones: el resumen sigue solo las integradas.",
    unsupported:
      "Aún no se pueden guardar tus instrucciones. Actualiza Memo en la página Herramientas para escribirlas.",
    failed: (message) => `No se guardó: ${message}`,
    template: {
      daily:
        "Primero: las respuestas que esperan de mí y las tareas que vencen hoy.\nProyectos importantes: \nPersonas importantes: \nOmitir: boletines, avisos de servicios y bots.\nComo mucho cinco puntos por sección.",
      weekly:
        "La semana en una página: qué avanzó en cada proyecto, qué decisiones siguen esperándome, pagos y facturas.\nProyectos importantes: \nOmitir: boletines, avisos de servicios y charlas sin importancia.\nComo mucho cinco puntos por sección.",
      own: "Recoger: \nPrimero: \nOmitir: boletines y avisos de servicios.\nComo mucho cinco puntos por sección.",
    },
  },
  templates: {
    empty: "La plantilla está vacía. Escríbela antes de guardar.",
    title: "Cómo se ve",
    hint: "La plantilla de este resumen para cada canal e idioma, en Liquid. Un cambio se comprueba antes de guardarlo.",
    channel: "Canal",
    language: "Idioma",
    channels: { telegram: "Telegram", email: "Correo", text: "Texto sin formato" },
    body: "Plantilla",
    own: "Tu propia plantilla",
    shipped: "La plantilla integrada",
    preview: "Vista previa",
    previewing: "Preparando la vista previa…",
    previewTitle: "Lo que se enviaría",
    previewSample: "Con un resumen de ejemplo: aún no hay uno real.",
    previewLast: "Con tu último resumen.",
    problems: "Esto no se puede guardar:",
    save: "Guardar",
    reset: "Volver a la predeterminada",
    unsupported:
      "Aún no se pueden cambiar las plantillas del resumen. Actualiza Memo en la página Herramientas para editarlas.",
    failed: (message) => `No se guardó: ${message}`,
    previewFailed: "No se pudo mostrar la vista previa.",
  },
}

export const editorMessages: Messages<typeof en> = { en, ru, es }
