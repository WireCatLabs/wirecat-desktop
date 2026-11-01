// cspell:words Ortiz Harbour Agrúpalo Muéstralos regístralo prepárame
// The shape proposed for guides.json in docs/dev/plans/2026-11-01-guides.md. Commands checked against the live
// command pages on wirecat.dev (2026-11-01); names and chats are made up.
import type { Lang } from "@/i18n"

type Text = { en: string; ru: string; es: string }

export type Guide = {
  id: string
  /** Every tool in `all` is needed; one of `any` is enough (a messenger); `extra` adds sources when installed. */
  needs: { all?: string[]; any?: string[]; extra?: string[] }
  title: Text
  outcome: Text
  prompt: Text
  steps: { text: Text; run: string }[]
  result: Text
  /** True when the agent saves something: the prompt asks it to show first and save after the owner agrees. */
  saves?: boolean
  /** Per language: the site's headings, and so their anchors, are translated. */
  docs: Text
}

export const textOf = (t: Text, lang: Lang) => t[lang]

const MESSENGERS = ["tg", "max", "wa"]

export const GUIDES: Guide[] = [
  {
    id: "catch-up",
    needs: { any: MESSENGERS },
    title: {
      en: "Catch up on what you missed",
      ru: "Узнать, что вы пропустили",
      es: "Ponerte al día con lo que te perdiste",
    },
    outcome: {
      en: "Questions waiting for you and promises made, chat by chat.",
      ru: "Вопросы к вам и обещания, по каждому чату.",
      es: "Preguntas pendientes y promesas, chat por chat.",
    },
    prompt: {
      en: "Use tg CLI. Show what I missed since yesterday evening in my work chats: questions to me, decisions, and anything I promised. Group it by chat, newest first, with a link to each message. Do not send anything.",
      ru: "Используй tg CLI. Покажи, что я пропустил со вчерашнего вечера в рабочих чатах: вопросы ко мне, решения и то, что я обещал. Сгруппируй по чатам, новые сверху, со ссылкой на каждое сообщение. Ничего не отправляй.",
      es: "Usa tg CLI. Muéstrame lo que me perdí desde ayer por la tarde en mis chats de trabajo: preguntas para mí, decisiones y lo que prometí. Agrúpalo por chat, lo más nuevo primero, con un enlace a cada mensaje. No envíes nada.",
    },
    steps: [
      {
        text: {
          en: "Reads the unread messages from other people",
          ru: "Читает непрочитанные сообщения от других",
          es: "Lee los mensajes no leídos de otras personas",
        },
        run: "tg inbox date>18h",
      },
      {
        text: {
          en: "Reads whole conversations that changed, yours too",
          ru: "Читает изменившиеся переписки целиком, с вашими сообщениями",
          es: "Lee las conversaciones que cambiaron, también tus mensajes",
        },
        run: "tg review date>18h",
      },
    ],
    result: {
      en: "A short list per chat. Each line links to the message it came from.",
      ru: "Короткий список по каждому чату. Каждая строка ведёт к своему сообщению.",
      es: "Una lista breve por chat. Cada línea enlaza al mensaje del que sale.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/recipes#morning-summary",
      ru: "https://wirecat.dev/ru/docs/tg/recipes#утренняя-сводка",
      es: "https://wirecat.dev/es/docs/tg/recipes#resumen-de-la-mañana",
    },
  },
  {
    id: "meeting-prep",
    needs: { all: ["memo"], extra: ["zm"] },
    title: {
      en: "Prepare for a call with someone",
      ru: "Подготовиться к звонку с человеком",
      es: "Preparar una llamada con alguien",
    },
    outcome: {
      en: "Recent messages, mail, notes and open tasks with one person, and three points to raise.",
      ru: "Недавние сообщения, письма, заметки и открытые задачи с человеком и три темы для разговора.",
      es: "Mensajes, correo, notas y tareas abiertas con una persona, y tres temas para tratar.",
    },
    prompt: {
      en: "Use memo CLI to prepare me for my call with Kai Sample tomorrow. Show our recent messages and mail, my notes about Kai, what we said in past meetings and the open tasks between us. Give me three points to raise, each with its source.",
      ru: "Используй memo CLI, чтобы подготовить меня к завтрашнему звонку с Kai Sample. Покажи наши недавние сообщения и письма, мои заметки о Kai, что мы говорили на прошлых встречах и открытые задачи между нами. Дай три темы для разговора, у каждой — источник.",
      es: "Usa memo CLI para prepararme para mi llamada de mañana con Kai Sample. Muestra nuestros mensajes y correos recientes, mis notas sobre Kai, lo que dijimos en reuniones anteriores y las tareas abiertas entre nosotros. Dame tres temas para tratar, cada uno con su fuente.",
    },
    steps: [
      {
        text: {
          en: "Collects messages, mail, notes and events about the person",
          ru: "Собирает сообщения, письма, заметки и события о человеке",
          es: "Reúne mensajes, correo, notas y eventos sobre la persona",
        },
        run: 'memo context "Kai Sample"',
      },
      {
        text: {
          en: "Reads what past meetings say about them",
          ru: "Читает, что о нём говорили на прошлых встречах",
          es: "Lee lo que dicen de esa persona las reuniones pasadas",
        },
        run: 'zm meetings context "Kai Sample"',
      },
      {
        text: {
          en: "Lists open tasks and keeps the ones with Kai",
          ru: "Перечисляет открытые задачи и оставляет те, что связаны с Kai",
          es: "Enumera las tareas abiertas y se queda con las de Kai",
        },
        run: "memo tasks list",
      },
    ],
    result: {
      en: "A one-screen brief and three talking points. Every point links to its source.",
      ru: "Сводка на один экран и три темы для разговора. У каждой темы есть ссылка на источник.",
      es: "Un resumen de una pantalla y tres temas. Cada tema enlaza a su fuente.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#prepare-for-a-meeting-with-someone",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#подготовка-к-встрече-с-человеком",
      es: "https://wirecat.dev/es/docs/memo/recipes#prepararte-para-una-reunión-con-alguien",
    },
  },
  {
    id: "requests-to-tasks",
    needs: { all: ["memo"], any: MESSENGERS },
    saves: true,
    title: {
      en: "Turn requests in your chats into tasks",
      ru: "Превратить просьбы из чатов в задачи",
      es: "Convertir las peticiones de tus chats en tareas",
    },
    outcome: {
      en: "Everything people asked you to do this week, as tasks you choose.",
      ru: "Всё, о чём вас просили за неделю, в виде задач, которые вы выберете.",
      es: "Todo lo que te pidieron esta semana, como tareas que tú eliges.",
    },
    prompt: {
      en: "Use tg CLI and memo CLI. Find messages from the last week where someone asked me to do something. List them with their sources. Create a task only for the ones I choose, linked to the message.",
      ru: "Используй tg CLI и memo CLI. Найди сообщения за последнюю неделю, где меня о чём-то просили. Покажи их со ссылками на источники. Создай задачи только для тех, что я выберу, со ссылкой на сообщение.",
      es: "Usa tg CLI y memo CLI. Busca los mensajes de la última semana en los que alguien me pidió algo. Muéstralos con sus fuentes. Crea una tarea solo para los que yo elija, enlazada al mensaje.",
    },
    steps: [
      {
        text: {
          en: "Reads the week's conversations, yours too",
          ru: "Читает переписку за неделю, с вашими сообщениями",
          es: "Lee las conversaciones de la semana, también tus mensajes",
        },
        run: "tg review date>7d",
      },
      {
        text: {
          en: "Adds a task for each request you pick",
          ru: "Добавляет задачу для каждой просьбы, которую вы выбрали",
          es: "Añade una tarea por cada petición que elijas",
        },
        run: "memo tasks add msg:telegram/…",
      },
    ],
    result: {
      en: "A list of requests to pick from, then tasks that link back to each message.",
      ru: "Список просьб на выбор, потом задачи со ссылками на сообщения.",
      es: "Una lista de peticiones para elegir y luego tareas que enlazan a cada mensaje.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#turn-requests-into-tasks",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#превратить-просьбы-в-задачи",
      es: "https://wirecat.dev/es/docs/memo/recipes#convertir-peticiones-en-tareas",
    },
  },
  {
    id: "document-facts",
    needs: { all: ["memo"], any: MESSENGERS },
    saves: true,
    title: {
      en: "Find a file someone sent and keep what matters",
      ru: "Найти файл, который прислали, и запомнить главное",
      es: "Encontrar un archivo que te enviaron y guardar lo importante",
    },
    outcome: {
      en: "The invoice Ana sent, its amount and due date, remembered with the message as proof.",
      ru: "Счёт, который прислала Ana: сумма и срок оплаты запомнены, с сообщением как доказательством.",
      es: "La factura que envió Ana: importe y vencimiento guardados, con el mensaje como prueba.",
    },
    prompt: {
      en: "Use tg CLI and memo CLI. Find the invoice Ana Ortiz sent me in October. Read it and show me the amount, the due date and who it is from. After I agree, record them as facts with the message as evidence.",
      ru: "Используй tg CLI и memo CLI. Найди счёт, который Ana Ortiz прислала мне в октябре. Прочитай его и покажи сумму, срок оплаты и от кого он. После моего согласия запиши это как факты, с сообщением как доказательством.",
      es: "Usa tg CLI y memo CLI. Busca la factura que Ana Ortiz me envió en octubre. Léela y muéstrame el importe, el vencimiento y de quién es. Cuando yo esté de acuerdo, regístralo como hechos con el mensaje como prueba.",
    },
    steps: [
      {
        text: {
          en: "Lists the documents in the chat",
          ru: "Перечисляет документы в чате",
          es: "Enumera los documentos del chat",
        },
        run: 'tg chats documents list "Ana Ortiz" invoice',
      },
      {
        text: {
          en: "Downloads the file",
          ru: "Скачивает файл",
          es: "Descarga el archivo",
        },
        run: "tg attachments download",
      },
      {
        text: {
          en: "Reads the text of the file into your archive",
          ru: "Добавляет текст файла в ваш архив",
          es: "Lee el texto del archivo y lo guarda en tu archivo",
        },
        run: "tg attachments extract",
      },
      {
        text: {
          en: "Records each fact you approve, with its source",
          ru: "Записывает каждый одобренный факт с источником",
          es: "Registra cada hecho que apruebes, con su fuente",
        },
        run: "memo facts add",
      },
    ],
    result: {
      en: "The facts, each with a link to the message and the file. Your agent asks before it saves.",
      ru: "Факты, у каждого ссылка на сообщение и файл. Агент спросит, прежде чем сохранить.",
      es: "Los hechos, cada uno con enlace al mensaje y al archivo. Tu agente pregunta antes de guardar.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#record-a-decision-from-a-chat",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#записать-решение-из-чата",
      es: "https://wirecat.dev/es/docs/memo/recipes#registrar-una-decisión-de-un-chat",
    },
  },
  {
    id: "call-follow-up",
    needs: { all: ["zm", "memo"] },
    saves: true,
    title: {
      en: "Turn a Zoom call into follow-ups",
      ru: "Превратить звонок в Zoom в план действий",
      es: "Convertir una llamada de Zoom en tareas",
    },
    outcome: {
      en: "The decisions and next steps from a call, as tasks and a draft follow-up.",
      ru: "Решения и следующие шаги со звонка: задачи и черновик письма-итога.",
      es: "Las decisiones y próximos pasos de una llamada: tareas y un borrador de seguimiento.",
    },
    prompt: {
      en: "Use zm CLI and memo CLI. Take today's call with the Harbour team. List the decisions and who agreed to do what, quoting the transcript. Propose a task for each action, and create only the ones I approve. Then draft a short follow-up message; do not send it.",
      ru: "Используй zm CLI и memo CLI. Возьми сегодняшний звонок с командой Harbour. Перечисли решения и кто что взялся сделать, с цитатами из расшифровки. Предложи задачу на каждое действие и создай только те, что я одобрю. Потом набросай короткое письмо-итог; не отправляй его.",
      es: "Usa zm CLI y memo CLI. Toma la llamada de hoy con el equipo de Harbour. Enumera las decisiones y quién se comprometió a qué, citando la transcripción. Propón una tarea por cada acción y crea solo las que yo apruebe. Luego redacta un breve mensaje de seguimiento; no lo envíes.",
    },
    steps: [
      {
        text: {
          en: "Finds the call among your meetings",
          ru: "Находит звонок среди ваших встреч",
          es: "Encuentra la llamada entre tus reuniones",
        },
        run: "zm meetings list",
      },
      {
        text: { en: "Reads the meeting summary", ru: "Читает итоги встречи", es: "Lee el resumen de la reunión" },
        run: "zm meetings summary <meeting>",
      },
      {
        text: {
          en: "Previews the task a line would become",
          ru: "Показывает, какой задачей станет строка",
          es: "Muestra qué tarea saldría de una línea",
        },
        run: "zm meetings task-proposal <line>",
      },
      {
        text: {
          en: "Adds the tasks you approve",
          ru: "Добавляет задачи, которые вы одобрили",
          es: "Añade las tareas que apruebes",
        },
        run: "memo tasks add",
      },
    ],
    result: {
      en: "Tasks that link to the moment in the call, and a draft you can edit and send yourself.",
      ru: "Задачи со ссылкой на момент звонка и черновик, который вы поправите и отправите сами.",
      es: "Tareas que enlazan al momento de la llamada y un borrador que editas y envías tú.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#review-a-meetings-decisions-and-follow-ups",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#проверить-решения-и-поручения-со-встречи",
      es: "https://wirecat.dev/es/docs/memo/recipes#revisar-las-decisiones-y-los-seguimientos-de-una-reunión",
    },
  },
  {
    id: "where-decided",
    needs: { all: ["memo"] },
    title: {
      en: "Find where something was decided",
      ru: "Найти, где было принято решение",
      es: "Encontrar dónde se decidió algo",
    },
    outcome: {
      en: "The message, mail or note where it happened, quoted, with the source.",
      ru: "Сообщение, письмо или заметка, где это случилось, с цитатой и источником.",
      es: "El mensaje, correo o nota donde ocurrió, citado y con su fuente.",
    },
    prompt: {
      en: "Use memo CLI to find where we decided the launch date for the Harbour project. Search my notes, mail and messages. Quote the text and show the source of each result. If you find nothing, tell me what you searched.",
      ru: "Используй memo CLI, чтобы найти, где мы решили дату запуска проекта Harbour. Ищи в заметках, почте и сообщениях. Процитируй текст и покажи источник каждого результата. Если ничего не найдёшь, скажи, где искал.",
      es: "Usa memo CLI para encontrar dónde decidimos la fecha de lanzamiento del proyecto Harbour. Busca en mis notas, correo y mensajes. Cita el texto y muestra la fuente de cada resultado. Si no encuentras nada, dime dónde buscaste.",
    },
    steps: [
      {
        text: {
          en: "Searches messages, mail, notes and events together",
          ru: "Ищет сразу в сообщениях, письмах, заметках и событиях",
          es: "Busca a la vez en mensajes, correo, notas y eventos",
        },
        run: 'memo search all "Harbour launch date"',
      },
      {
        text: {
          en: "Looks closer in one kind of source",
          ru: "Уточняет поиск в одном виде источников",
          es: "Afina la búsqueda en un tipo de fuente",
        },
        run: 'memo search mail "launch date"',
      },
    ],
    result: {
      en: "Quotes with their sources, or a plain account of where it looked.",
      ru: "Цитаты с источниками или честный рассказ, где агент искал.",
      es: "Citas con sus fuentes, o una explicación clara de dónde buscó.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#find-where-something-was-decided",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#где-было-принято-решение",
      es: "https://wirecat.dev/es/docs/memo/recipes#encontrar-dónde-se-decidió-algo",
    },
  },
  {
    id: "plan-the-day",
    needs: { all: ["memo"] },
    title: { en: "Plan your day", ru: "Спланировать день", es: "Planificar tu día" },
    outcome: {
      en: "What is overdue, who waits for your answer, and what others are doing for you.",
      ru: "Что просрочено, кто ждёт вашего ответа и что для вас делают другие.",
      es: "Lo atrasado, quién espera tu respuesta y lo que otros hacen por ti.",
    },
    prompt: {
      en: "Use memo CLI. Plan my day: tasks that are overdue or due today, chats where I owe an answer, and reminders for today. Suggest an order and say why. Do not change anything.",
      ru: "Используй memo CLI. Спланируй мой день: просроченные задачи и задачи на сегодня, чаты, где я должен ответить, и напоминания на сегодня. Предложи порядок и объясни почему. Ничего не меняй.",
      es: "Usa memo CLI. Planifica mi día: tareas atrasadas o para hoy, chats donde debo una respuesta y recordatorios de hoy. Sugiere un orden y explica por qué. No cambies nada.",
    },
    steps: [
      {
        text: {
          en: "Reads what needs a look today",
          ru: "Читает, что требует внимания сегодня",
          es: "Lee lo que necesita atención hoy",
        },
        run: "memo tasks agenda",
      },
      {
        text: {
          en: "Lists today's reminders",
          ru: "Перечисляет напоминания на сегодня",
          es: "Enumera los recordatorios de hoy",
        },
        run: "memo reminders list",
      },
    ],
    result: {
      en: "An ordered list for the day, with the reason for each place.",
      ru: "Список дел на день по порядку, с объяснением порядка.",
      es: "Una lista ordenada para el día, con el motivo de cada lugar.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/tasks",
      ru: "https://wirecat.dev/ru/docs/memo/tasks",
      es: "https://wirecat.dev/es/docs/memo/tasks",
    },
  },
  {
    id: "check-before-reply",
    needs: { any: MESSENGERS },
    title: {
      en: "Check your promises before you reply",
      ru: "Проверить обещания перед ответом",
      es: "Revisar tus promesas antes de responder",
    },
    outcome: {
      en: "What you promised someone, what is done, and a draft reply you send yourself.",
      ru: "Что вы обещали человеку, что сделано, и черновик ответа, который вы отправите сами.",
      es: "Lo que prometiste, lo que está hecho y un borrador que envías tú.",
    },
    prompt: {
      en: "Use tg CLI. Before I reply to the contractor, check our chat and the Renovation group for the last two weeks. What did we promise, what is done, and what needs clarifying? Draft a reply that cites those messages. Show the draft; do not send it.",
      ru: "Используй tg CLI. Прежде чем я отвечу подрядчику, проверь наш чат и группу «Ремонт» за последние две недели. Что мы обещали, что сделано и что нужно уточнить? Набросай ответ со ссылками на эти сообщения. Покажи черновик, не отправляй.",
      es: "Usa tg CLI. Antes de responder al contratista, revisa nuestro chat y el grupo Reforma de las últimas dos semanas. ¿Qué prometimos, qué está hecho y qué hay que aclarar? Redacta una respuesta que cite esos mensajes. Muéstrame el borrador; no lo envíes.",
    },
    steps: [
      {
        text: {
          en: "Reads what the archive holds about the person",
          ru: "Читает, что архив знает о человеке",
          es: "Lee lo que el archivo sabe de la persona",
        },
        run: 'tg contacts context "Contractor"',
      },
      {
        text: {
          en: "Reads the group's recent messages",
          ru: "Читает последние сообщения группы",
          es: "Lee los mensajes recientes del grupo",
        },
        run: 'tg messages list "Renovation"',
      },
    ],
    result: {
      en: "A checklist of promises and a draft reply. Nothing is sent.",
      ru: "Список обещаний и черновик ответа. Ничего не отправляется.",
      es: "Una lista de promesas y un borrador de respuesta. No se envía nada.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/recipes#draft-a-reply",
      ru: "https://wirecat.dev/ru/docs/tg/recipes#составьте-ответ",
      es: "https://wirecat.dev/es/docs/tg/recipes#redactar-una-respuesta",
    },
  },
  {
    id: "drive-brief",
    needs: { all: ["drive"] },
    title: {
      en: "Brief yourself on a project from Drive",
      ru: "Собрать сводку по проекту из Drive",
      es: "Resumir un proyecto desde Drive",
    },
    outcome: {
      en: "The current documents of a project, what changed and what is still open.",
      ru: "Актуальные документы проекта, что изменилось и что ещё открыто.",
      es: "Los documentos actuales del proyecto, qué cambió y qué sigue abierto.",
    },
    prompt: {
      en: "Use drive CLI. Refresh my Harbour folder, then brief me for tomorrow's meeting: the latest budget and plan, what changed this week, and open questions. Link every document you use.",
      ru: "Используй drive CLI. Обнови папку Harbour и подготовь сводку к завтрашней встрече: последний бюджет и план, что изменилось за неделю и открытые вопросы. Дай ссылку на каждый документ.",
      es: "Usa drive CLI. Actualiza mi carpeta Harbour y prepárame un resumen para la reunión de mañana: el último presupuesto y plan, qué cambió esta semana y las preguntas abiertas. Enlaza cada documento que uses.",
    },
    steps: [
      {
        text: {
          en: "Brings in what changed in your folders",
          ru: "Загружает изменения в ваших папках",
          es: "Trae lo que cambió en tus carpetas",
        },
        run: "drive sync",
      },
      {
        text: {
          en: "Finds the documents by words and by meaning",
          ru: "Находит документы по словам и по смыслу",
          es: "Encuentra los documentos por palabras y por significado",
        },
        run: 'drive search "Harbour budget"',
      },
      {
        text: {
          en: "Reads a document with its notes and links",
          ru: "Читает документ с заметками и связями",
          es: "Lee un documento con sus notas y enlaces",
        },
        run: "drive documents context <document>",
      },
    ],
    result: {
      en: "A one-page brief that links each document it used.",
      ru: "Сводка на одну страницу со ссылками на все документы.",
      es: "Un resumen de una página que enlaza cada documento usado.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/drive/recipes#refresh-a-project-and-prepare-a-meeting-brief",
      ru: "https://wirecat.dev/ru/docs/drive/recipes#обновить-проект-и-подготовиться-к-встрече",
      es: "https://wirecat.dev/es/docs/drive/recipes#actualizar-un-proyecto-y-preparar-una-reunión",
    },
  },
  {
    id: "remember-preference",
    needs: { all: ["memo"], any: MESSENGERS },
    saves: true,
    title: {
      en: "Remember what someone prefers",
      ru: "Запомнить, что предпочитает человек",
      es: "Recordar lo que alguien prefiere",
    },
    outcome: {
      en: "A preference your agent will keep in mind next time, with the message it came from.",
      ru: "Предпочтение, которое агент учтёт в следующий раз, со ссылкой на сообщение.",
      es: "Una preferencia que tu agente tendrá en cuenta, con el mensaje de donde salió.",
    },
    prompt: {
      en: "Use memo CLI to find what Kai Sample said about meeting times. Show me the memory you would save and the message it is based on. Save it with the message as evidence only after I agree.",
      ru: "Используй memo CLI, чтобы найти, что Kai Sample говорил о времени встреч. Покажи, что ты сохранишь, и сообщение, на котором это основано. Сохрани со ссылкой на сообщение только после моего согласия.",
      es: "Usa memo CLI para encontrar lo que dijo Kai Sample sobre los horarios de reunión. Muéstrame el recuerdo que guardarías y el mensaje en el que se basa. Guárdalo con el mensaje como prueba solo cuando yo esté de acuerdo.",
    },
    steps: [
      {
        text: { en: "Searches the messages", ru: "Ищет в сообщениях", es: "Busca en los mensajes" },
        run: 'memo search messages "Kai meeting times"',
      },
      {
        text: {
          en: "Saves the memory you approve, with its source",
          ru: "Сохраняет одобренное воспоминание с источником",
          es: "Guarda el recuerdo que apruebes, con su fuente",
        },
        run: "memo memories add",
      },
    ],
    result: {
      en: "One memory, linked to its message. Later answers about Kai take it into account.",
      ru: "Одно воспоминание со ссылкой на сообщение. Следующие ответы о Kai будут его учитывать.",
      es: "Un recuerdo enlazado a su mensaje. Las próximas respuestas sobre Kai lo tendrán en cuenta.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#remember-a-preference-with-its-source",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#запомнить-предпочтение-вместе-с-источником",
      es: "https://wirecat.dev/es/docs/memo/recipes#recordar-una-preferencia-con-su-fuente",
    },
  },
]
