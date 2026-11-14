import { formatBytes } from "@/domain/format"
import type { ConditionWords } from "@/domain/mail-rules"
import { type Messages, plural, pluralRu } from "@/i18n"

const KINDS_EN: Record<string, string> = {
  social: "social networks",
  newsletters: "newsletters",
  developer: "developer notifications",
  shopping: "shops and orders",
  alerts: "alerts and notices",
}

const PROVIDERS: Record<string, string> = { telemost: "Telemost" }
const provider = (id: string) => PROVIDERS[id] ?? id

const en = {
  menu: "Mail rules",
  title: (profile: string) => `Mail rules for ${profile}`,
  what: "Which mail this mailbox stores whole, keeps as an envelope (sender, date and size, no text) or skips. Each sync follows them.",
  close: "Close mail rules",
  loading: "Reading mail rules…",
  addHint:
    "Rules are added and changed in a terminal. For example, this one saves Telemost meeting notes from mail as meetings and keeps those emails whole and protected:",
  addLabel: "Copy the command",
  none: "No rules yet",
  noneText: "This mailbox stores all its mail whole.",
  listFailed: "Could not read the mail rules.",
  needsUpdate: "This version of Email cannot list mail rules yet. Update it on the Tools page.",
  retry: "Try again",
  pages: "Pages of mail rules",
  match: {
    from: (v) => `from ${v}`,
    from_contains: (v) => `sender contains “${v}”`,
    domain: (v) => `domain ${v}`,
    to: (v) => `to ${v}`,
    list_id: (v) => `mailing list ${v}`,
    subject: (v) => `subject has “${v}”`,
    older_than_days: (v) => `older than ${plural("en", Number(v), { one: "# day", other: "# days" })}`,
    larger_than_bytes: (v) => `larger than ${formatBytes(Number(v))}`,
    has_attachments: (v) => (v === "true" ? "with attachments" : "without attachments"),
    label: (v) => `label ${v}`,
    unread: (v) => (v === "true" ? "unread" : "read"),
    bulk: (v) => (v === "true" ? "bulk mail" : "not bulk mail"),
    score_at_least: (v) => `sender score ${v} or more`,
    preset: (v) => `kind: ${KINDS_EN[v] ?? v}`,
  } satisfies ConditionWords as ConditionWords,
  action: { keep: "Stored whole", envelope: "Envelope only", skip: "Skipped" } as Record<string, string>,
  protected: "Protected",
  meetingNotes: (id: string) => `${provider(id)} meeting notes`,
  tags: (tags: string) => `Tags: ${tags}`,
  maker: { you: "Added by you", preset: "Built-in kind", agent: "Suggested by an agent", gmail: "From a Gmail filter" },
  otherMaker: (source: string) => `Source: ${source}`,
  recorded: (emails: number, bytes: number) =>
    `${plural("en", emails, { one: "# email", other: "# emails" })} recorded, ${formatBytes(bytes)}`,
}

const ru: typeof en = {
  menu: "Правила почты",
  title: (profile) => `Правила почты для ${profile}`,
  what: "Какие письма этот ящик хранит целиком, какие только конвертом (отправитель, дата и размер, без текста), а какие пропускает. Каждая синхронизация следует им.",
  close: "Закрыть правила почты",
  loading: "Читаем правила почты…",
  addHint:
    "Правила добавляют и меняют в терминале. Например, это правило сохраняет конспекты встреч Телемоста из почты как встречи, а сами письма хранит целиком и под защитой:",
  addLabel: "Скопировать команду",
  none: "Правил пока нет",
  noneText: "Этот ящик хранит все письма целиком.",
  listFailed: "Не удалось прочитать правила почты.",
  needsUpdate: "Эта версия Email ещё не умеет показывать правила почты. Обновите её на странице «Инструменты».",
  retry: "Повторить",
  pages: "Страницы правил почты",
  match: {
    from: (v) => `от ${v}`,
    from_contains: (v) => `отправитель содержит «${v}»`,
    domain: (v) => `домен ${v}`,
    to: (v) => `кому: ${v}`,
    list_id: (v) => `рассылка ${v}`,
    subject: (v) => `в теме «${v}»`,
    older_than_days: (v) => `старше ${pluralRu(Number(v), ["# дня", "# дней", "# дней"])}`,
    larger_than_bytes: (v) => `больше ${formatBytes(Number(v))}`,
    has_attachments: (v) => (v === "true" ? "с вложениями" : "без вложений"),
    label: (v) => `метка ${v}`,
    unread: (v) => (v === "true" ? "непрочитанные" : "прочитанные"),
    bulk: (v) => (v === "true" ? "массовые рассылки" : "не массовые рассылки"),
    score_at_least: (v) => `оценка отправителя от ${v}`,
    preset: (v) =>
      `вид: ${
        {
          social: "соцсети",
          newsletters: "рассылки",
          developer: "уведомления для разработчиков",
          shopping: "магазины и заказы",
          alerts: "оповещения",
        }[v] ?? v
      }`,
  },
  action: { keep: "Хранится целиком", envelope: "Только конверт", skip: "Пропускается" },
  protected: "Защищено",
  meetingNotes: (id) => `Конспекты встреч ${id === "telemost" ? "Телемоста" : provider(id)}`,
  tags: (tags) => `Теги: ${tags}`,
  maker: {
    you: "Добавили вы",
    preset: "Встроенный вид",
    agent: "Предложил агент",
    gmail: "Из фильтра Gmail",
  },
  otherMaker: (source) => `Источник: ${source}`,
  recorded: (emails, bytes) =>
    `${pluralRu(emails, ["# письмо", "# письма", "# писем"])} записано, ${formatBytes(bytes)}`,
}

const es: typeof en = {
  menu: "Reglas de correo",
  title: (profile) => `Reglas de correo de ${profile}`,
  what: "Qué correo guarda entero este buzón, cuál guarda solo como sobre (remitente, fecha y tamaño, sin texto) y cuál omite. Cada sincronización las sigue.",
  close: "Cerrar las reglas de correo",
  loading: "Leyendo las reglas de correo…",
  addHint:
    "Las reglas se añaden y cambian en una terminal. Por ejemplo, esta guarda como reuniones las notas de Telemost que llegan por correo, y conserva esos correos enteros y protegidos:",
  addLabel: "Copiar el comando",
  none: "Aún no hay reglas",
  noneText: "Este buzón guarda todo su correo entero.",
  listFailed: "No se pudieron leer las reglas de correo.",
  needsUpdate: "Esta versión de Email aún no puede mostrar reglas de correo. Actualízala en la página Herramientas.",
  retry: "Reintentar",
  pages: "Páginas de reglas de correo",
  match: {
    from: (v) => `de ${v}`,
    from_contains: (v) => `el remitente contiene «${v}»`,
    domain: (v) => `dominio ${v}`,
    to: (v) => `para ${v}`,
    list_id: (v) => `lista de correo ${v}`,
    subject: (v) => `asunto con «${v}»`,
    older_than_days: (v) => `de más de ${plural("es", Number(v), { one: "# día", other: "# días" })}`,
    larger_than_bytes: (v) => `de más de ${formatBytes(Number(v))}`,
    has_attachments: (v) => (v === "true" ? "con adjuntos" : "sin adjuntos"),
    label: (v) => `etiqueta ${v}`,
    unread: (v) => (v === "true" ? "sin leer" : "leído"),
    bulk: (v) => (v === "true" ? "correo masivo" : "correo no masivo"),
    score_at_least: (v) => `puntuación del remitente de ${v} o más`,
    preset: (v) =>
      `tipo: ${
        {
          social: "redes sociales",
          newsletters: "boletines",
          developer: "avisos para desarrolladores",
          shopping: "tiendas y pedidos",
          alerts: "alertas y avisos",
        }[v] ?? v
      }`,
  },
  action: { keep: "Se guarda entero", envelope: "Solo el sobre", skip: "Se omite" },
  protected: "Protegido",
  meetingNotes: (id) => `Notas de reuniones de ${provider(id)}`,
  tags: (tags) => `Etiquetas: ${tags}`,
  maker: {
    you: "Añadida por ti",
    preset: "Tipo integrado",
    agent: "Sugerida por un agente",
    gmail: "De un filtro de Gmail",
  },
  otherMaker: (source) => `Origen: ${source}`,
  recorded: (emails, bytes) =>
    `${plural("es", emails, { one: "# correo", other: "# correos" })} registrados, ${formatBytes(bytes)}`,
}

export const mailRulesMessages: Messages<typeof en> = { en, ru, es }
