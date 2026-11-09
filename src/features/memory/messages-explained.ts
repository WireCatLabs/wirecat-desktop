import type { Tab } from "@/domain/memory"
import type { RelationParts } from "@/domain/relationships"
import { type Messages, plural } from "@/i18n"

/** One end of a relationship as a sentence names it. */
type End = { kind: string; name: string }

const curly = (e: End) => (e.kind === "person" ? e.name : `“${e.name}”`)
const guillemets = (e: End) => (e.kind === "person" ? e.name : `«${e.name}»`)

const lower = (s: string) => s.charAt(0).toLocaleLowerCase() + s.slice(1)

const EN_KINDS: Record<string, string> = {
  document: "Document",
  note: "Note",
  project: "Project",
  organization: "Organization",
  person: "Person",
  deal: "Deal",
  lead: "Lead",
  contract: "Contract",
  task: "Task",
}

const en = {
  intro: "What your agents know about you and the people around you. Agents suggest; you decide what is true.",
  how: [
    { title: "An agent suggests", body: "from a chat, an email, a document or a meeting" },
    { title: "You check it", body: "see where it came from, edit it if needed, then approve or reject" },
    { title: "Agents use it", body: "what you approved, agents take as true when they answer you" },
  ],
  tabHint: {
    review: "Agents suggested these. Until you approve one, agents treat it as not confirmed.",
    inuse: "What agents take as true: what you approved, and what your connected apps report.",
    discarded: "What you rejected or replaced. Agents do not use it.",
    all: "Everything in memory, in every state.",
  } satisfies Record<Tab, string>,
  status: {
    review: "Waiting for you",
    inuse: "In use",
    approved: "Approved",
    done: "Done",
    failed: "Failed",
    discarded: "Rejected",
    replaced: "Replaced",
    other: "Other",
  } as Record<string, string>,
  groupCount: (waiting: number, total: number) =>
    waiting > 0
      ? `${waiting} waiting for you · ${total} in all`
      : plural("en", total, { one: "# record", other: "# records" }),
  approveAll: (n: number) => `Approve all ${n}`,
  rejectAll: (n: number) => `Reject all ${n}`,
  approveAllHint: "Agents take every waiting record in this group as true.",
  rejectAllHint: "Agents do not use any waiting record in this group.",
  bulkDone: (approved: number, rejected: number, failed: number) =>
    [approved && `${approved} approved`, rejected && `${rejected} rejected`, failed && `${failed} failed`]
      .filter(Boolean)
      .join(" · "),
  kindWord: EN_KINDS as Record<string, string>,
  relationKind: "Link",
  withRole: (p: RelationParts, role: string) =>
    `${p.holder.name} is the ${lower(role)} ${
      p.other.kind === "person"
        ? `for ${p.other.name}`
        : `of the ${lower(EN_KINDS[p.other.kind] ?? "record")} ${curly(p.other)}`
    }`,
  noRole: {
    "member-of": (from: End, to: End) => `${curly(from)} is a member of ${curly(to)}`,
    "reports-to": (from: End, to: End) => `${curly(from)} reports to ${curly(to)}`,
    "customer-of": (from: End, to: End) => `${curly(from)} is a customer of ${curly(to)}`,
    "partner-of": (from: End, to: End) => `${curly(from)} and ${curly(to)} are partners`,
    other: (from: End, to: End) => `${curly(from)} is linked to ${curly(to)}`,
  } as Record<string, (from: End, to: End) => string>,
  ifApprove: "If you approve",
  ifReject: "If you reject",
  approveEffect: "agents take this as true when they answer you.",
  rejectEffect: "agents do not use it. It moves to Rejected, where you can still see it.",
  inUseEffect: "Agents take this as true when they answer you.",
  reportedEffect: (app: string) => `${app} reports this. Agents take it as true while ${app} says so.`,
  discardedEffect: "Agents do not use this.",
  whatWouldBeSaved: "What agents will know",
  whereFrom: "Where it came from",
  sourceGone: "The source is not in memory any more.",
  noSource: "The agent gave no source for this.",
  edit: "Edit",
  text: "Text",
  kind: "Kind",
  about: "About",
  nobody: "Nobody in particular",
  role: "Role",
  noRoleChoice: "No role",
  roleFree: "Role, in your words",
  save: "Save",
  saveAndApprove: "Save and approve",
  cancel: "Cancel",
  remove: "Remove link",
  removeHint: "Agents stop using this link. The people and the document stay.",
  removing: "Removing…",
  editFailed: "Could not save:",
}

const ru: typeof en = {
  intro: "Что ваши агенты знают о вас и о людях вокруг вас. Агенты предлагают, вы решаете, что из этого правда.",
  how: [
    { title: "Агент предлагает", body: "из чата, письма, документа или встречи" },
    { title: "Вы проверяете", body: "смотрите, откуда это, при необходимости правите, одобряете или отклоняете" },
    { title: "Агенты используют", body: "одобренное агенты считают правдой, когда отвечают вам" },
  ],
  tabHint: {
    review: "Это предложили агенты. Пока вы не одобрите запись, агенты считают её неподтверждённой.",
    inuse: "То, что агенты считают правдой: одобренное вами и то, что сообщают подключённые сервисы.",
    discarded: "То, что вы отклонили или заменили. Агенты это не используют.",
    all: "Всё, что есть в памяти, в любом состоянии.",
  },
  status: {
    review: "Ждёт решения",
    inuse: "Используется",
    approved: "Одобрено",
    done: "Сделано",
    failed: "Не удалось",
    discarded: "Отклонено",
    replaced: "Заменено",
    other: "Другое",
  },
  groupCount: (waiting, total) =>
    waiting > 0
      ? `${plural("ru", waiting, { one: "# ждёт", few: "# ждут", many: "# ждут", other: "# ждут" })} решения · всего ${total}`
      : plural("ru", total, { one: "# запись", few: "# записи", many: "# записей", other: "# записи" }),
  approveAll: (n) => `Одобрить все (${n})`,
  rejectAll: (n) => `Отклонить все (${n})`,
  approveAllHint: "Агенты будут считать правдой все ждущие записи этой группы.",
  rejectAllHint: "Агенты не будут использовать ни одну ждущую запись этой группы.",
  bulkDone: (approved, rejected, failed) =>
    [approved && `одобрено: ${approved}`, rejected && `отклонено: ${rejected}`, failed && `не удалось: ${failed}`]
      .filter(Boolean)
      .join(" · "),
  kindWord: {
    document: "Документ",
    note: "Заметка",
    project: "Проект",
    organization: "Организация",
    person: "Человек",
    deal: "Сделка",
    lead: "Лид",
    contract: "Договор",
    task: "Задача",
  },
  relationKind: "Связь",
  withRole: (p, role) => {
    const of: Record<string, string> = {
      document: "документа",
      note: "заметки",
      project: "проекта",
      organization: "организации",
      deal: "сделки",
      lead: "лида",
      contract: "договора",
      task: "задачи",
    }
    const other =
      p.other.kind === "person" ? `для ${p.other.name}` : `${of[p.other.kind] ?? "записи"} ${guillemets(p.other)}`
    return `${p.holder.name} — ${lower(role)} ${other}`
  },
  noRole: {
    "member-of": (from, to) => `${guillemets(from)} входит в ${guillemets(to)}`,
    "reports-to": (from, to) => `${guillemets(from)} подчиняется ${guillemets(to)}`,
    "customer-of": (from, to) => `${guillemets(from)} — клиент ${guillemets(to)}`,
    "partner-of": (from, to) => `${guillemets(from)} и ${guillemets(to)} — партнёры`,
    other: (from, to) => `${guillemets(from)} связан с ${guillemets(to)}`,
  },
  ifApprove: "Если одобрите",
  ifReject: "Если отклоните",
  approveEffect: "агенты будут считать это правдой, когда отвечают вам.",
  rejectEffect: "агенты не будут это использовать. Запись перейдёт в «Отклонено», где её по-прежнему видно.",
  inUseEffect: "Агенты считают это правдой, когда отвечают вам.",
  reportedEffect: (app) => `Так сообщает ${app}. Агенты считают это правдой, пока ${app} так говорит.`,
  discardedEffect: "Агенты это не используют.",
  whatWouldBeSaved: "Что будут знать агенты",
  whereFrom: "Откуда это",
  sourceGone: "Источника больше нет в памяти.",
  noSource: "Агент не указал источник.",
  edit: "Изменить",
  text: "Текст",
  kind: "Вид",
  about: "О ком",
  nobody: "Ни о ком конкретно",
  role: "Роль",
  noRoleChoice: "Без роли",
  roleFree: "Роль, своими словами",
  save: "Сохранить",
  saveAndApprove: "Сохранить и одобрить",
  cancel: "Отмена",
  remove: "Удалить связь",
  removeHint: "Агенты перестанут использовать эту связь. Люди и документ останутся.",
  removing: "Удаляю…",
  editFailed: "Не удалось сохранить:",
}

const es: typeof en = {
  intro:
    "Lo que tus agentes saben de ti y de las personas a tu alrededor. Los agentes proponen; tú decides qué es cierto.",
  how: [
    { title: "Un agente propone", body: "a partir de un chat, un correo, un documento o una reunión" },
    { title: "Tú lo revisas", body: "mira de dónde viene, corrígelo si hace falta, y apruébalo o recházalo" },
    { title: "Los agentes lo usan", body: "lo que apruebas, los agentes lo toman como cierto al responderte" },
  ],
  tabHint: {
    review: "Esto lo propusieron los agentes. Hasta que lo apruebes, los agentes lo tratan como no confirmado.",
    inuse: "Lo que los agentes toman como cierto: lo que aprobaste y lo que informan tus apps conectadas.",
    discarded: "Lo que rechazaste o sustituiste. Los agentes no lo usan.",
    all: "Todo lo que hay en la memoria, en cualquier estado.",
  },
  status: {
    review: "Pendiente",
    inuse: "En uso",
    approved: "Aprobado",
    done: "Hecho",
    failed: "Falló",
    discarded: "Rechazado",
    replaced: "Sustituido",
    other: "Otro",
  },
  groupCount: (waiting, total) =>
    waiting > 0
      ? `${waiting} pendientes · ${total} en total`
      : plural("es", total, { one: "# registro", other: "# registros" }),
  approveAll: (n) => `Aprobar todo (${n})`,
  rejectAll: (n) => `Rechazar todo (${n})`,
  approveAllHint: "Los agentes tomarán como cierto cada registro pendiente de este grupo.",
  rejectAllHint: "Los agentes no usarán ningún registro pendiente de este grupo.",
  bulkDone: (approved, rejected, failed) =>
    [approved && `aprobados: ${approved}`, rejected && `rechazados: ${rejected}`, failed && `fallidos: ${failed}`]
      .filter(Boolean)
      .join(" · "),
  kindWord: {
    document: "Documento",
    note: "Nota",
    project: "Proyecto",
    organization: "Organización",
    person: "Persona",
    deal: "Trato",
    lead: "Lead",
    contract: "Contrato",
    task: "Tarea",
  },
  relationKind: "Vínculo",
  withRole: (p, role) => {
    const of: Record<string, string> = {
      document: "del documento",
      note: "de la nota",
      project: "del proyecto",
      organization: "de la organización",
      deal: "del trato",
      lead: "del lead",
      contract: "del contrato",
      task: "de la tarea",
    }
    const other =
      p.other.kind === "person"
        ? `para ${p.other.name}`
        : `${of[p.other.kind] ?? "del registro"} ${guillemets(p.other)}`
    return `${p.holder.name} — ${lower(role)} ${other}`
  },
  noRole: {
    "member-of": (from, to) => `${guillemets(from)} forma parte de ${guillemets(to)}`,
    "reports-to": (from, to) => `${guillemets(from)} depende de ${guillemets(to)}`,
    "customer-of": (from, to) => `${guillemets(from)} es cliente de ${guillemets(to)}`,
    "partner-of": (from, to) => `${guillemets(from)} y ${guillemets(to)} son socios`,
    other: (from, to) => `${guillemets(from)} está vinculado con ${guillemets(to)}`,
  },
  ifApprove: "Si lo apruebas",
  ifReject: "Si lo rechazas",
  approveEffect: "los agentes lo tomarán como cierto al responderte.",
  rejectEffect: "los agentes no lo usarán. Pasa a Rechazado, donde aún puedes verlo.",
  inUseEffect: "Los agentes lo toman como cierto al responderte.",
  reportedEffect: (app) => `Lo informa ${app}. Los agentes lo toman como cierto mientras ${app} lo diga.`,
  discardedEffect: "Los agentes no lo usan.",
  whatWouldBeSaved: "Lo que sabrán los agentes",
  whereFrom: "De dónde viene",
  sourceGone: "La fuente ya no está en la memoria.",
  noSource: "El agente no indicó ninguna fuente.",
  edit: "Editar",
  text: "Texto",
  kind: "Tipo",
  about: "Sobre quién",
  nobody: "Nadie en concreto",
  role: "Rol",
  noRoleChoice: "Sin rol",
  roleFree: "Rol, con tus palabras",
  save: "Guardar",
  saveAndApprove: "Guardar y aprobar",
  cancel: "Cancelar",
  remove: "Quitar vínculo",
  removeHint: "Los agentes dejan de usar este vínculo. Las personas y el documento se quedan.",
  removing: "Quitando…",
  editFailed: "No se pudo guardar:",
}

export const explainedMessages: Messages<typeof en> = { en, ru, es }
