// cspell:words Ortiz Harbour Muéstramelo Ponme créala añádelas
import type { Guide } from "./guides"

const MESSENGERS = ["tg", "max", "wa"]

export const MORE_GUIDES: Guide[] = [
  {
    id: "group-catch-up",
    goal: "catch-up",
    needs: { any: MESSENGERS },
    title: {
      en: "Catch up on one busy group",
      ru: "Наверстать переписку в активной группе",
      es: "Ponerte al día con un grupo muy activo",
    },
    outcome: {
      en: "What a group decided in three days, and the questions still open.",
      ru: "Что группа решила за три дня и какие вопросы остались открытыми.",
      es: "Lo que decidió un grupo en tres días y las preguntas que siguen abiertas.",
    },
    prompt: {
      en: "Use tg CLI. Catch me up on the Renovation group over the last three days: what was decided, who took on what, and which questions still wait for an answer. Give each point its date, author and a link to the message. Do not send anything.",
      ru: "Используй tg CLI. Расскажи, что было в группе «Ремонт» за последние три дня: что решили, кто что взялся сделать и какие вопросы ещё ждут ответа. У каждого пункта — дата, автор и ссылка на сообщение. Ничего не отправляй.",
      es: "Usa tg CLI. Ponme al día con el grupo Reforma de los últimos tres días: qué se decidió, quién se encargó de qué y qué preguntas siguen sin respuesta. Da a cada punto su fecha, su autor y un enlace al mensaje. No envíes nada.",
    },
    steps: [
      {
        text: {
          en: "Reads every message of the group from the last three days",
          ru: "Читает все сообщения группы за три дня",
          es: "Lee todos los mensajes del grupo de los últimos tres días",
        },
        run: 'tg review "chat:Renovation date>3d"',
      },
      {
        text: {
          en: "Picks out the questions nobody answered",
          ru: "Выбирает вопросы, на которые никто не ответил",
          es: "Separa las preguntas que nadie respondió",
        },
        run: 'tg review "chat:Renovation date>3d" --unanswered',
      },
    ],
    result: {
      en: "A short report: decisions, who does what, open questions. Each point links to its message.",
      ru: "Короткий отчёт: решения, кто что делает, открытые вопросы. Каждый пункт ведёт к своему сообщению.",
      es: "Un informe breve: decisiones, quién hace qué y preguntas abiertas. Cada punto enlaza a su mensaje.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/recipes#weekly-report-on-a-chat",
      ru: "https://wirecat.dev/ru/docs/tg/recipes#еженедельный-отчет-по-чату",
      es: "https://wirecat.dev/es/docs/tg/recipes#informe-semanal-sobre-un-chat",
    },
  },
  {
    id: "meetings-week",
    goal: "catch-up",
    needs: { all: ["zm"] },
    title: {
      en: "See what this week's meetings decided",
      ru: "Узнать, что решили на встречах за неделю",
      es: "Ver qué se decidió en las reuniones de la semana",
    },
    outcome: {
      en: "Each meeting of the week: its decisions, next steps and who spoke.",
      ru: "По каждой встрече недели: решения, следующие шаги и кто говорил.",
      es: "Cada reunión de la semana: decisiones, próximos pasos y quién habló.",
    },
    prompt: {
      en: "Use zm CLI. Bring in this week's Zoom meetings and sum up each one: what was decided, the next steps and who owns them. Check anything I should act on against the transcript and quote it. Do not change anything in Zoom.",
      ru: "Используй zm CLI. Загрузи встречи в Zoom за эту неделю и подведи итог каждой: что решили, какие следующие шаги и кто за них отвечает. Всё, что касается моих действий, сверь с расшифровкой и процитируй. Ничего не меняй в Zoom.",
      es: "Usa zm CLI. Trae las reuniones de Zoom de esta semana y resume cada una: qué se decidió, los próximos pasos y quién se encarga. Comprueba con la transcripción todo lo que me toque hacer y cítalo. No cambies nada en Zoom.",
    },
    steps: [
      {
        text: {
          en: "Brings in new meetings and transcripts that came late",
          ru: "Загружает новые встречи и расшифровки, которые пришли позже",
          es: "Trae las reuniones nuevas y las transcripciones que llegaron tarde",
        },
        run: "zm meetings sync --lookback-days 7",
      },
      {
        text: {
          en: "Reads each meeting's summary, next steps and who talked how long",
          ru: "Читает итоги каждой встречи, следующие шаги и кто сколько говорил",
          es: "Lee el resumen de cada reunión, los próximos pasos y cuánto habló cada uno",
        },
        run: "zm review --since-time 7d",
      },
      {
        text: {
          en: "Reads the exact words when a point matters",
          ru: "Читает точные слова, когда пункт важен",
          es: "Lee las palabras exactas cuando un punto importa",
        },
        run: "zm meetings transcript <meeting>",
      },
    ],
    result: {
      en: "One block per meeting, with quotes from the transcript where it counts.",
      ru: "Блок на каждую встречу, с цитатами из расшифровки там, где это важно.",
      es: "Un bloque por reunión, con citas de la transcripción donde importa.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/zm/scenarios#catch-up-on-recent-meetings",
      ru: "https://wirecat.dev/ru/docs/zm/scenarios#наверстать-недавние-встречи",
      es: "https://wirecat.dev/es/docs/zm/scenarios#ponerse-al-día-con-las-reuniones-recientes",
    },
  },
  {
    id: "project-in-one-place",
    goal: "gather",
    needs: { all: ["memo"] },
    title: {
      en: "Gather everything about a project",
      ru: "Собрать всё о проекте в одном месте",
      es: "Reunir todo sobre un proyecto",
    },
    outcome: {
      en: "Key documents, open tasks and recent mentions of a project, with sources.",
      ru: "Ключевые документы, открытые задачи и недавние упоминания проекта, с источниками.",
      es: "Documentos clave, tareas abiertas y menciones recientes de un proyecto, con fuentes.",
    },
    prompt: {
      en: "Use memo CLI. Gather what I have on the Harbour project: its key documents, open tasks, and what was said about it in messages, mail and meetings in the last 60 days. Link every source and say which history is missing. Do not confirm or save anything.",
      ru: "Используй memo CLI. Собери всё, что у меня есть по проекту Harbour: ключевые документы, открытые задачи и что о нём говорили в сообщениях, письмах и на встречах за последние 60 дней. Дай ссылку на каждый источник и скажи, какой истории не хватает. Ничего не подтверждай и не сохраняй.",
      es: "Usa memo CLI. Reúne lo que tengo sobre el proyecto Harbour: sus documentos clave, las tareas abiertas y lo que se dijo de él en mensajes, correo y reuniones en los últimos 60 días. Enlaza cada fuente y dime qué historial falta. No confirmes ni guardes nada.",
    },
    steps: [
      {
        text: {
          en: "Opens the project: key documents first, then open tasks",
          ru: "Открывает проект: сначала ключевые документы, потом открытые задачи",
          es: "Abre el proyecto: primero los documentos clave, luego las tareas abiertas",
        },
        run: "memo projects context Harbour",
      },
      {
        text: {
          en: "Finds what messages, mail and meetings say about it",
          ru: "Находит, что о нём говорят сообщения, письма и встречи",
          es: "Encuentra lo que dicen de él los mensajes, el correo y las reuniones",
        },
        run: "memo projects evidence Harbour --source all --since-time 60d",
      },
    ],
    result: {
      en: "One page: what to read first, what is open, and where the project came up.",
      ru: "Одна страница: что прочитать сначала, что открыто и где упоминался проект.",
      es: "Una página: qué leer primero, qué está abierto y dónde salió el proyecto.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/people#key-documents-of-a-project",
      ru: "https://wirecat.dev/ru/docs/memo/people#ключевые-документы-проекта",
      es: "https://wirecat.dev/es/docs/memo/people#documentos-clave-de-un-proyecto",
    },
  },
  {
    id: "shared-links",
    goal: "gather",
    needs: { any: MESSENGERS },
    title: {
      en: "Collect the links people shared on a topic",
      ru: "Собрать ссылки, которыми делились по теме",
      es: "Reunir los enlaces compartidos sobre un tema",
    },
    outcome: {
      en: "Every link about Harbour from the last month, who sent it and where.",
      ru: "Все ссылки о Harbour за последний месяц: кто прислал и в каком чате.",
      es: "Todos los enlaces sobre Harbour del último mes: quién los envió y dónde.",
    },
    prompt: {
      en: "Use tg CLI. Find every message with a link about the Harbour project from the last 30 days. List the links grouped by site, with who shared each one, in which chat and when, and a link to the message. Do not send anything.",
      ru: "Используй tg CLI. Найди все сообщения со ссылками о проекте Harbour за последние 30 дней. Перечисли ссылки по сайтам: кто прислал, в каком чате и когда, со ссылкой на сообщение. Ничего не отправляй.",
      es: "Usa tg CLI. Busca todos los mensajes con enlaces sobre el proyecto Harbour de los últimos 30 días. Enumera los enlaces agrupados por sitio, con quién compartió cada uno, en qué chat y cuándo, y un enlace al mensaje. No envíes nada.",
    },
    steps: [
      {
        text: {
          en: "Finds messages about the topic that hold a link",
          ru: "Находит сообщения по теме, в которых есть ссылка",
          es: "Encuentra los mensajes sobre el tema que llevan un enlace",
        },
        run: 'tg search messages "Harbour has:link date:30d"',
      },
      {
        text: {
          en: "Shows which sites your chats link to most",
          ru: "Показывает, на какие сайты чаще всего ссылаются ваши чаты",
          es: "Muestra a qué sitios enlazan más tus chats",
        },
        run: "tg mentions domains",
      },
    ],
    result: {
      en: "A list of links by site. Each one links back to the message it came in.",
      ru: "Список ссылок по сайтам. Каждая ведёт к сообщению, в котором пришла.",
      es: "Una lista de enlaces por sitio. Cada uno lleva al mensaje en el que llegó.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/query-language#mentions",
      ru: "https://wirecat.dev/ru/docs/tg/query-language#упоминания",
      es: "https://wirecat.dev/es/docs/tg/query-language#menciones",
    },
  },
  {
    id: "who-you-talk-to",
    goal: "analyze",
    needs: { any: MESSENGERS },
    title: {
      en: "See who you talk to most, and who went quiet",
      ru: "Узнать, с кем вы общаетесь чаще всего и кто пропал",
      es: "Ver con quién hablas más y quién dejó de escribir",
    },
    outcome: {
      en: "Who wrote most in the last 30 days, and who wrote before but stopped.",
      ru: "Кто писал больше всех за 30 дней и кто писал раньше, но перестал.",
      es: "Quién escribió más en 30 días y quién escribía antes pero dejó de hacerlo.",
    },
    prompt: {
      en: "Use tg CLI. Show who wrote me the most in one-to-one chats in the last 30 days, and who wrote often in the two months before but has been quiet since. Keep it to the top ten of each. Do not send anything.",
      ru: "Используй tg CLI. Покажи, кто больше всего писал мне в личных чатах за последние 30 дней и кто часто писал в предыдущие два месяца, но с тех пор молчит. По десять человек в каждом списке. Ничего не отправляй.",
      es: "Usa tg CLI. Muéstrame quién me escribió más en chats privados en los últimos 30 días y quién escribía a menudo en los dos meses anteriores pero desde entonces no dice nada. Diez personas como máximo en cada lista. No envíes nada.",
    },
    steps: [
      {
        text: {
          en: "Ranks people in one-to-one chats by messages in the last 30 days",
          ru: "Ранжирует собеседников в личных чатах по числу сообщений за 30 дней",
          es: "Ordena a las personas de tus chats privados por mensajes de los últimos 30 días",
        },
        run: 'tg stats contacts top "kind:private date:30d" --measure messages --limit 30',
      },
      {
        text: {
          en: "Ranks them again for the two months before",
          ru: "Ранжирует их ещё раз за два месяца до этого",
          es: "Vuelve a ordenarlas para los dos meses anteriores",
        },
        run: 'tg stats contacts top "kind:private date:[90d TO 30d}" --measure messages --limit 10',
      },
    ],
    result: {
      en: "Two short lists: the people you hear from most, and the ones who went quiet.",
      ru: "Два коротких списка: от кого вы слышите чаще всего и кто замолчал.",
      es: "Dos listas breves: de quién sabes más a menudo y quién dejó de escribir.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/commands#tg-stats-contacts-top",
      ru: "https://wirecat.dev/ru/docs/tg/commands#tg-stats-contacts-top",
      es: "https://wirecat.dev/es/docs/tg/commands#tg-stats-contacts-top",
    },
  },
  {
    id: "meeting-time",
    goal: "analyze",
    needs: { all: ["zm"] },
    title: {
      en: "See where your meeting time went",
      ru: "Узнать, на что ушло время встреч",
      es: "Ver en qué se fue tu tiempo de reuniones",
    },
    outcome: {
      en: "Your meetings of the last 30 days, how long they took and who talked most.",
      ru: "Встречи за 30 дней: сколько они длились и кто говорил больше всех.",
      es: "Tus reuniones de 30 días: cuánto duraron y quién habló más.",
    },
    prompt: {
      en: "Use zm CLI. For the last 30 days, show how many meetings I had, how long they lasted in total and week by week, and who spoke the most. Point out the longest meetings. Do not change anything.",
      ru: "Используй zm CLI. Покажи за последние 30 дней, сколько у меня было встреч, сколько они длились всего и по неделям и кто говорил больше всех. Отметь самые длинные встречи. Ничего не меняй.",
      es: "Usa zm CLI. De los últimos 30 días, muéstrame cuántas reuniones tuve, cuánto duraron en total y semana a semana, y quién habló más. Señala las reuniones más largas. No cambies nada.",
    },
    steps: [
      {
        text: {
          en: "Lists the meetings with their length",
          ru: "Перечисляет встречи с их длительностью",
          es: "Enumera las reuniones con su duración",
        },
        run: "zm review --since-time 30d --limit 200",
      },
      {
        text: {
          en: "Counts meetings and talk time week by week",
          ru: "Считает встречи и время разговора по неделям",
          es: "Cuenta las reuniones y el tiempo de habla semana a semana",
        },
        run: "zm stats meetings show --since-time 30d",
      },
      {
        text: {
          en: "Ranks speakers by talk time",
          ru: "Ранжирует участников по времени разговора",
          es: "Ordena a los participantes por tiempo de habla",
        },
        run: "zm stats meetings top --since-time 30d",
      },
    ],
    result: {
      en: "Totals per week, the longest meetings, and the speakers by talk time.",
      ru: "Итоги по неделям, самые длинные встречи и участники по времени разговора.",
      es: "Totales por semana, las reuniones más largas y los participantes por tiempo de habla.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/zm/commands#zm-stats-meetings-show",
      ru: "https://wirecat.dev/ru/docs/zm/commands#zm-stats-meetings-show",
      es: "https://wirecat.dev/es/docs/zm/commands#zm-stats-meetings-show",
    },
  },
  {
    id: "requests-pile-up",
    goal: "analyze",
    needs: { any: MESSENGERS },
    title: {
      en: "Find the chats where requests pile up",
      ru: "Найти чаты, где копятся просьбы",
      es: "Encontrar los chats donde se acumulan peticiones",
    },
    outcome: {
      en: "Open requests and questions per chat, and how long the oldest one waits.",
      ru: "Открытые просьбы и вопросы по чатам и сколько ждёт самый старый.",
      es: "Peticiones y preguntas abiertas por chat, y cuánto espera la más antigua.",
    },
    prompt: {
      en: "Use tg CLI. Show which chats have the most open requests and questions, how old the oldest one is, and how long things usually take to close there. Then list the questions from the last 30 days that nobody answered. Do not send anything.",
      ru: "Используй tg CLI. Покажи, в каких чатах больше всего открытых просьб и вопросов, сколько ждёт самый старый и сколько обычно уходит на то, чтобы их закрыть. Потом перечисли вопросы за последние 30 дней, на которые никто не ответил. Ничего не отправляй.",
      es: "Usa tg CLI. Muéstrame qué chats tienen más peticiones y preguntas abiertas, cuánto lleva esperando la más antigua y cuánto se suele tardar en cerrarlas allí. Después enumera las preguntas de los últimos 30 días que nadie respondió. No envíes nada.",
    },
    steps: [
      {
        text: {
          en: "Counts open tasks per chat, with the oldest and the usual time to close",
          ru: "Считает открытые задачи по чатам, с самой старой и обычным сроком закрытия",
          es: "Cuenta las tareas abiertas por chat, con la más antigua y el tiempo habitual de cierre",
        },
        run: "tg stats tasks show",
      },
      {
        text: {
          en: "Finds questions nobody answered",
          ru: "Находит вопросы, на которые никто не ответил",
          es: "Encuentra las preguntas que nadie respondió",
        },
        run: 'tg stats messages unanswered "date:30d"',
      },
    ],
    result: {
      en: "A table of chats, worst first, and a list of questions still waiting.",
      ru: "Таблица чатов, худшие сверху, и список вопросов, которые ещё ждут ответа.",
      es: "Una tabla de chats, los peores primero, y una lista de preguntas que siguen esperando.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/rankings#questions-waiting-for-an-answer",
      ru: "https://wirecat.dev/ru/docs/tg/rankings#вопросы-которые-ждут-ответа",
      es: "https://wirecat.dev/es/docs/tg/rankings#preguntas-pendientes",
    },
  },
  {
    id: "check-a-claim",
    goal: "verify",
    needs: { all: ["zm"] },
    title: {
      en: "Check what was really said in a call",
      ru: "Проверить, что на самом деле сказали на звонке",
      es: "Comprobar lo que se dijo de verdad en una llamada",
    },
    outcome: {
      en: "The exact lines from the transcript, with speaker and time, for or against.",
      ru: "Точные строки из расшифровки, с говорящим и временем, — за или против.",
      es: "Las líneas exactas de la transcripción, con quién y cuándo, a favor o en contra.",
    },
    prompt: {
      en: "Use zm CLI. Kai Sample says we agreed in a call last month to move the Harbour launch to March. Search the meeting transcripts and quote the lines where the launch date came up, with who said them and when. Tell me plainly whether the transcript supports the claim. If you find nothing, tell me what you searched.",
      ru: "Используй zm CLI. Kai Sample говорит, что в прошлом месяце на звонке мы договорились перенести запуск Harbour на март. Поищи в расшифровках встреч и процитируй строки, где обсуждали дату запуска, — кто и когда это сказал. Скажи прямо, подтверждает ли это расшифровка. Если ничего не найдёшь, скажи, что искал.",
      es: "Usa zm CLI. Kai Sample dice que el mes pasado acordamos en una llamada mover el lanzamiento de Harbour a marzo. Busca en las transcripciones de las reuniones y cita las líneas donde salió la fecha de lanzamiento, con quién lo dijo y cuándo. Dime claramente si la transcripción lo respalda. Si no encuentras nada, dime qué buscaste.",
    },
    steps: [
      {
        text: {
          en: "Searches the transcripts of recent meetings",
          ru: "Ищет в расшифровках недавних встреч",
          es: "Busca en las transcripciones de las reuniones recientes",
        },
        run: 'zm search meetings "Harbour launch date>=60d"',
      },
      {
        text: {
          en: "Reads the lines around each hit, with speakers and times",
          ru: "Читает строки вокруг каждой находки, с говорящими и временем",
          es: "Lee las líneas alrededor de cada resultado, con quién habla y cuándo",
        },
        run: "zm meetings passage <reference>",
      },
    ],
    result: {
      en: "Quotes with speaker and time, and a plain yes, no or not found.",
      ru: "Цитаты с говорящим и временем и прямой ответ: да, нет или не найдено.",
      es: "Citas con quién y cuándo, y una respuesta clara: sí, no o no encontrado.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/zm/scenarios#find-what-was-said-with-its-line",
      ru: "https://wirecat.dev/ru/docs/zm/scenarios#найти-сказанное-вместе-с-точной-строкой",
      es: "https://wirecat.dev/es/docs/zm/scenarios#encontrar-lo-que-se-dijo-con-su-línea",
    },
  },
  {
    id: "morning-summary-daily",
    goal: "schedule",
    needs: { any: ["tg", "max"] },
    saves: true,
    title: {
      en: "Get a summary of new messages every morning",
      ru: "Получать сводку новых сообщений каждое утро",
      es: "Tener un resumen de mensajes nuevos cada mañana",
    },
    outcome: {
      en: "A summary of what came in overnight, ready for you at 8:30 each day.",
      ru: "Сводка того, что пришло за ночь, готова каждый день в 8:30.",
      es: "Un resumen de lo que llegó por la noche, listo cada día a las 8:30.",
    },
    prompt: {
      en: "Use tg CLI. Set up a daily run at 8:30 that starts Claude to sum up my new messages since the last run: one line per chat, what needs an answer today first. It must only read, never send. Show me the schedule first and create it only after I agree.",
      ru: "Используй tg CLI. Настрой ежедневный запуск в 8:30: пусть Claude подводит итог новых сообщений с прошлого запуска — строка на чат, сначала то, что требует ответа сегодня. Он должен только читать и ничего не отправлять. Сначала покажи расписание и создай его только после моего согласия.",
      es: "Usa tg CLI. Configura una ejecución diaria a las 8:30 que inicie Claude para resumir mis mensajes nuevos desde la última vez: una línea por chat, primero lo que necesita respuesta hoy. Solo debe leer, nunca enviar. Muéstrame primero la programación y créala solo cuando yo esté de acuerdo.",
    },
    steps: [
      {
        text: {
          en: "Creates the daily run; the agent it starts can read but not send",
          ru: "Создаёт ежедневный запуск; агент в нём может читать, но не отправлять",
          es: "Crea la ejecución diaria; el agente que inicia puede leer, pero no enviar",
        },
        run: 'tg schedule agent morning claude "…" --at 08:30 --max-cost 1',
      },
      {
        text: {
          en: "Shows the schedule and how its last run went",
          ru: "Показывает расписание и как прошёл последний запуск",
          es: "Muestra la programación y cómo fue la última ejecución",
        },
        run: "tg schedule list",
      },
    ],
    result: {
      en: "A timer on your computer. Each morning the summary is kept for you and you get a notice.",
      ru: "Таймер на вашем компьютере. Каждое утро сводка сохраняется, и вы получаете уведомление.",
      es: "Un temporizador en tu ordenador. Cada mañana se guarda el resumen y recibes un aviso.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/tg/recipes#running-on-a-schedule",
      ru: "https://wirecat.dev/ru/docs/tg/recipes#работа-по-расписанию",
      es: "https://wirecat.dev/es/docs/tg/recipes#programar-las-ejecuciones",
    },
  },
  {
    id: "follow-up-reminder",
    goal: "schedule",
    needs: { all: ["memo"], any: MESSENGERS },
    saves: true,
    title: {
      en: "Get reminded to follow up when no one answers",
      ru: "Получить напоминание, если вам не ответили",
      es: "Acordarte de insistir cuando nadie responde",
    },
    outcome: {
      en: "Chats where you wait for an answer, and reminders for the ones you pick.",
      ru: "Чаты, где вы ждёте ответа, и напоминания по тем, что вы выберете.",
      es: "Chats donde esperas respuesta y recordatorios para los que elijas.",
    },
    prompt: {
      en: "Use memo CLI. Find chats where I wrote last and have had no answer for three days or more. Show who it was and what I asked. For the ones I choose, add a task to follow up, linked to my message, with a reminder on Monday at 9:00. Show me first and add them only after I agree.",
      ru: "Используй memo CLI. Найди чаты, где я написал последним и мне не отвечают три дня или больше. Покажи, кому и о чём я писал. Для тех, что я выберу, добавь задачу написать ещё раз, со ссылкой на моё сообщение и напоминанием на понедельник, 9:00. Сначала покажи и добавь только после моего согласия.",
      es: "Usa memo CLI. Busca los chats donde escribí yo el último y nadie me responde desde hace tres días o más. Muéstrame a quién y qué pregunté. Para los que elija, añade una tarea de seguimiento enlazada a mi mensaje, con un recordatorio el lunes a las 9:00. Muéstramelo primero y añádelas solo cuando yo esté de acuerdo.",
    },
    steps: [
      {
        text: {
          en: "Lists chats where you wrote last and wait for an answer",
          ru: "Перечисляет чаты, где вы написали последним и ждёте ответа",
          es: "Enumera los chats donde escribiste el último y esperas respuesta",
        },
        run: "memo tasks agenda --waiting 3d",
      },
      {
        text: {
          en: "Adds a follow-up task linked to your message",
          ru: "Добавляет задачу со ссылкой на ваше сообщение",
          es: "Añade una tarea de seguimiento enlazada a tu mensaje",
        },
        run: "memo tasks add msg:telegram/…",
      },
      {
        text: {
          en: "Sets the reminder on that task",
          ru: "Ставит напоминание на эту задачу",
          es: "Pone el recordatorio en esa tarea",
        },
        run: "memo reminders add <task> --at-time … --account telegram:…",
      },
    ],
    result: {
      en: "Follow-up tasks with a reminder date. Your agent brings them up when it checks your reminders.",
      ru: "Задачи с датой напоминания. Агент покажет их, когда проверит ваши напоминания.",
      es: "Tareas de seguimiento con fecha de recordatorio. Tu agente te las muestra cuando revisa tus recordatorios.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/tasks#reminders",
      ru: "https://wirecat.dev/ru/docs/memo/tasks#напоминания",
      es: "https://wirecat.dev/es/docs/memo/tasks#recordatorios",
    },
  },
  {
    id: "zoom-invitation",
    goal: "schedule",
    needs: { all: ["zm"] },
    saves: true,
    title: {
      en: "Set up a Zoom call and get its invitation",
      ru: "Назначить звонок в Zoom и получить приглашение",
      es: "Programar una llamada de Zoom y obtener la invitación",
    },
    outcome: {
      en: "A new Zoom meeting and its invitation text, ready to paste.",
      ru: "Новая встреча в Zoom и текст приглашения, готовый к отправке.",
      es: "Una reunión nueva de Zoom y el texto de invitación, listo para pegar.",
    },
    prompt: {
      en: 'Use zm CLI. Set up a 30-minute Zoom call called "Harbour planning" next Tuesday at 10:00 Madrid time. Show me the preview first and create it only after I agree. Then give me the invitation text so I can send it myself.',
      ru: "Используй zm CLI. Назначь звонок в Zoom на 30 минут с названием «Harbour planning» на следующий вторник в 10:00 по Мадриду. Сначала покажи, что будет создано, и создай встречу только после моего согласия. Потом дай текст приглашения, чтобы я отправил его сам.",
      es: "Usa zm CLI. Programa una llamada de Zoom de 30 minutos llamada «Harbour planning» el próximo martes a las 10:00, hora de Madrid. Muéstrame primero la vista previa y créala solo cuando yo esté de acuerdo. Luego dame el texto de la invitación para que la envíe yo.",
    },
    steps: [
      {
        text: {
          en: "Previews the meeting without creating it",
          ru: "Показывает встречу, не создавая её",
          es: "Muestra la reunión sin crearla",
        },
        run: 'zm remote-meetings create --title "Harbour planning" --start-time … --duration-minutes 30 --dry-run',
      },
      {
        text: {
          en: "Creates it once you agree",
          ru: "Создаёт её после вашего согласия",
          es: "La crea cuando estás de acuerdo",
        },
        run: 'zm remote-meetings create --title "Harbour planning" --start-time … --duration-minutes 30 --yes',
      },
      {
        text: {
          en: "Reads the invitation text",
          ru: "Читает текст приглашения",
          es: "Lee el texto de la invitación",
        },
        run: "zm remote-meetings invitation <meeting>",
      },
    ],
    result: {
      en: "The meeting in your Zoom account and its invitation. You send it yourself.",
      ru: "Встреча в вашем аккаунте Zoom и приглашение к ней. Отправляете его вы сами.",
      es: "La reunión en tu cuenta de Zoom y su invitación. La envías tú.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/zm/remote-meetings#create-update-or-cancel",
      ru: "https://wirecat.dev/ru/docs/zm/remote-meetings#создать-изменить-или-отменить",
      es: "https://wirecat.dev/es/docs/zm/remote-meetings#crear-modificar-o-cancelar",
    },
  },
  {
    id: "plan-the-week",
    goal: "plan",
    needs: { all: ["memo"] },
    title: { en: "Plan your week", ru: "Спланировать неделю", es: "Planificar tu semana" },
    outcome: {
      en: "Tasks due this week, chats that wait on you, and open work by project.",
      ru: "Задачи на неделю, чаты, где ждут вас, и открытая работа по проектам.",
      es: "Tareas de la semana, chats que esperan tu respuesta y trabajo abierto por proyecto.",
    },
    prompt: {
      en: "Use memo CLI. Plan my week: tasks that are overdue or due in the next 7 days, chats where I owe an answer, and how many open tasks each project has. Suggest what to do on which day and say why. Do not change anything.",
      ru: "Используй memo CLI. Спланируй мою неделю: просроченные задачи и задачи на ближайшие 7 дней, чаты, где я должен ответить, и сколько открытых задач в каждом проекте. Предложи, что делать в какой день, и объясни почему. Ничего не меняй.",
      es: "Usa memo CLI. Planifica mi semana: tareas atrasadas o que vencen en los próximos 7 días, chats donde debo una respuesta y cuántas tareas abiertas tiene cada proyecto. Sugiere qué hacer cada día y explica por qué. No cambies nada.",
    },
    steps: [
      {
        text: {
          en: "Reads what is overdue or due within a week, and who waits for you",
          ru: "Читает, что просрочено или нужно сделать за неделю и кто ждёт вашего ответа",
          es: "Lee lo atrasado o lo que vence en una semana, y quién espera tu respuesta",
        },
        run: "memo tasks agenda --due-within 7d",
      },
      {
        text: {
          en: "Counts open tasks by project",
          ru: "Считает открытые задачи по проектам",
          es: "Cuenta las tareas abiertas por proyecto",
        },
        run: "memo tasks counts project:*",
      },
    ],
    result: {
      en: "A plan by day for the week, with the reason for each choice.",
      ru: "План на неделю по дням, с объяснением каждого выбора.",
      es: "Un plan de la semana por días, con el motivo de cada elección.",
    },
    docs: {
      en: "https://wirecat.dev/en/docs/memo/recipes#weekly-review",
      ru: "https://wirecat.dev/ru/docs/memo/recipes#обзор-за-неделю",
      es: "https://wirecat.dev/es/docs/memo/recipes#revisión-semanal",
    },
  },
]
