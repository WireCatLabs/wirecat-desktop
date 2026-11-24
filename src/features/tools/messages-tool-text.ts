// Each tool's tagline and summary in Russian and Spanish, by catalog id; English is the catalog's own.

import type { Lang } from "@/i18n"

/** A name the service itself uses in that language, as its users know it; tools.json's name everywhere else. */
export const LOCAL_NAMES: Record<string, Partial<Record<Lang, string>>> = {
  ydisk: { ru: "Яндекс Диск" },
}

export const RU_TAGLINE: Record<string, string> = {
  tg: "Чаты и боты\u00a0· поиск по смыслу\u00a0· аналитика",
  max: "Чаты и боты\u00a0· поиск по смыслу\u00a0· аналитика",
  wa: "Чаты и боты\u00a0· поиск по смыслу\u00a0· аналитика",
  slk: "Каналы, личные сообщения и треды Slack\u00a0· чтение и поиск",
  zm: "Записи и расшифровки встреч\u00a0· поиск",
  drive: "Папки и документы\u00a0· поиск\u00a0· редактирование",
  gcal: "События и встречи\u00a0· поиск\u00a0· изменения",
  memo: "Заметки, файлы и хранилища Obsidian\u00a0· поиск по всему",
  email: "Ваша почта по IMAP, с поиском на вашем компьютере",
  notion: "Страницы и базы данных\u00a0· поиск",
  ydisk: "Папки и файлы\u00a0· поиск",
  bitrix: "Сделки, лиды, контакты и компании\u00a0· изменения",
  amo: "Сделки, контакты и компании\u00a0· изменения",
  attio: "Сделки, люди и компании\u00a0· история изменений",
  hubspot: "Сделки, контакты и компании\u00a0· изменения",
  linear: "Задачи, проекты и комментарии",
  wordpress: "Записи и страницы\u00a0· черновики",
  pbx: "Звонки и записи разговоров\u00a0· расшифровки",
}

export const RU_SUMMARY: Record<string, string> = {
  tg: "Клиент Telegram для терминала и ИИ-агентов, на вашем собственном аккаунте.",
  max: "MAX Messenger из терминала: боты через официальный Bot API и ваш личный аккаунт.",
  wa: "Ваш аккаунт WhatsApp из терминала, как связанное устройство, для агентов и скриптов.",
  slk: "Читайте каналы, личные сообщения и треды Slack и ищите в них вместе с агентом, а когда вы разрешите, отправляйте сообщения от своего имени.",
  zm: "Сохраняйте расшифровки и записи Zoom, ищите в них нужное и давайте агенту контекст к следующему звонку.",
  drive:
    "Импортируйте выбранные папки Google, ищите по документам локально и храните теги, заметки и воспоминания со ссылкой на источник.",
  gcal: "Копируйте события Google Календаря на этот компьютер, ищите по ним без сети и давайте агенту контекст каждой встречи.",
  memo: "Ваши заметки, файлы, хранилища Obsidian и сообщения в одном месте для ИИ-агента: поиск, теги, люди и воспоминания, на вашем компьютере.",
  email:
    "Gmail, Outlook и другая почта IMAP, скопированная на ваш компьютер: ищите по ней без сети, читайте переписку целиком и смотрите, докуда дошла каждая синхронизация. Синхронизация никогда не меняет ваш ящик.",
  notion:
    "Копируйте на этот компьютер страницы и базы данных Notion, которые видит ваш токен, ищите по ним и давайте агенту их текст.",
  ydisk: "Импортируйте выбранные папки Яндекс Диска, ищите по их файлам на этом компьютере и давайте агенту их текст.",
  bitrix:
    "Читайте и меняйте CRM портала Битрикс24 — сделки, лиды, контакты и компании — со страницы «Клиенты» и через вашего агента.",
  amo: "Читайте и меняйте CRM аккаунта amoCRM или Kommo — сделки, контакты и компании — со страницы «Клиенты» и через вашего агента.",
  attio:
    "Читайте CRM рабочего пространства Attio — сделки с их этапами, людей и компании — со страницы «Клиенты» и через вашего агента.",
  hubspot:
    "Читайте и меняйте CRM аккаунта HubSpot: сделки, контакты и компании, со страницы «Клиенты» и через вашего агента.",
  linear:
    "Копируйте задачи, проекты и комментарии рабочего пространства Linear на этот компьютер, чтобы агент читал их и, если вы разрешите, менял.",
  wordpress:
    "Копируйте записи и страницы сайта WordPress с их метками, рубриками и авторами на этот компьютер, чтобы агент читал их и, если вы разрешите, писал черновики и публиковал.",
  pbx: "Загружайте записи о звонках и записи разговоров вашей АТС Asterisk как встречи, расшифровывайте звонки на этом компьютере и давайте агенту то, что в них сказано.",
}

export const ES_TAGLINE: Record<string, string> = {
  tg: "Chats y bots\u00a0· búsqueda por significado\u00a0· analítica",
  max: "Chats y bots\u00a0· búsqueda por significado\u00a0· analítica",
  wa: "Chats y bots\u00a0· búsqueda por significado\u00a0· analítica",
  slk: "Canales, mensajes directos e hilos de Slack\u00a0· lectura y búsqueda",
  zm: "Grabaciones y transcripciones\u00a0· búsqueda",
  drive: "Carpetas y documentos\u00a0· búsqueda\u00a0· edición",
  gcal: "Eventos y reuniones\u00a0· búsqueda\u00a0· cambios",
  memo: "Notas, archivos y bóvedas de Obsidian\u00a0· búsqueda",
  email: "Tu correo por IMAP, con búsqueda en tu ordenador",
  notion: "Páginas y bases de datos\u00a0· búsqueda",
  ydisk: "Carpetas y archivos\u00a0· búsqueda",
  bitrix: "Negociaciones, prospectos y contactos\u00a0· cambios",
  amo: "Negociaciones, contactos y empresas\u00a0· cambios",
  attio: "Negociaciones, personas y empresas\u00a0· historial de cambios",
  hubspot: "Negociaciones, contactos y empresas\u00a0· cambios",
  linear: "Incidencias, proyectos y comentarios",
  wordpress: "Entradas y páginas\u00a0· borradores",
  pbx: "Llamadas y grabaciones\u00a0· transcripciones",
}

export const ES_SUMMARY: Record<string, string> = {
  tg: "Un cliente de Telegram para el terminal y para agentes de IA, con tu propia cuenta.",
  max: "MAX Messenger desde el terminal: bots mediante la Bot API oficial y tu cuenta personal.",
  wa: "Tu cuenta de WhatsApp desde el terminal, como dispositivo vinculado, para agentes y scripts.",
  slk: "Lee y busca en tus canales, mensajes directos e hilos de Slack con tu agente, y envía mensajes en tu nombre cuando lo permitas.",
  zm: "Guarda transcripciones y grabaciones de Zoom, busca en lo que se dijo en las reuniones y da contexto a tu agente para la próxima llamada.",
  drive:
    "Importa carpetas de Google seleccionadas, busca en los documentos en local y guarda etiquetas, notas y memorias con su fuente.",
  gcal: "Copia los eventos de Google Calendar a este equipo, búscalos sin conexión y da a tu agente el contexto de cada reunión.",
  memo: "Tus notas, archivos, bóvedas de Obsidian y mensajes en un solo lugar para tu agente de IA: búsqueda, etiquetas, personas y memorias, en tu ordenador.",
  email:
    "Gmail, Outlook y otro correo IMAP copiado a tu equipo: búscalo sin conexión, lee hilos enteros y mira hasta dónde llegó cada sincronización. La sincronización nunca cambia tu buzón.",
  notion:
    "Copia a este equipo las páginas y bases de datos de Notion que ve tu token, búscalas y da a tu agente su texto.",
  ydisk:
    "Importa las carpetas de Yandex Disk que elijas, busca en sus archivos en este equipo y da a tu agente su texto.",
  bitrix:
    "Lee y cambia el CRM de un portal de Bitrix24 —negociaciones, prospectos, contactos y empresas— desde la página Clientes y con tu agente.",
  amo: "Lee y cambia el CRM de una cuenta de amoCRM o Kommo —negociaciones, contactos y empresas— desde la página Clientes y con tu agente.",
  attio:
    "Lee el CRM de un espacio de trabajo de Attio —negociaciones con sus etapas, personas y empresas— desde la página Clientes y con tu agente.",
  hubspot:
    "Lee y cambia el CRM de una cuenta de HubSpot: negociaciones, contactos y empresas, desde la página Clientes y con tu agente.",
  linear:
    "Copia las incidencias, proyectos y comentarios de un espacio de trabajo de Linear a este equipo, para que tu agente los lea y, si lo permites, los cambie.",
  wordpress:
    "Copia las entradas y páginas de un sitio WordPress, con sus etiquetas, categorías y autores, a este equipo, para que tu agente las lea y, si lo permites, escriba borradores y publique.",
  pbx: "Importa los registros de llamadas y las grabaciones de tu centralita Asterisk como reuniones, transcribe las llamadas en este equipo y da a tu agente lo que se dijo.",
}
