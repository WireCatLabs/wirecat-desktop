import type { Messages } from "@/i18n"

const en = {
  decision: (text: string) => `Decision on: ${text}`,
  keep: "Approve",
  drop: "Reject",
  markAll: "All findings",
  keepAll: "Approve all",
  dropAll: "Reject all",
  kindHint: {
    fact: "Fact: something the agent wants remembered.",
    task: "Task: a task the agent proposes to create.",
    other: "Other labels say what is saved: an invoice, a contact, a change to a task.",
  } as Record<string, string>,
  save: (keep: number, drop: number): string =>
    keep === 0
      ? `Save: reject all ${drop}`
      : drop === 0
        ? `Save: create ${keep}`
        : `Save: create ${keep}, reject ${drop}`,
  saveNote: (mail: boolean, project: string): string =>
    mail
      ? "Nothing is saved until you press Save. Each approved finding is kept as its label says. Nothing is sent to anyone."
      : `Nothing is created until you press Save. Facts are kept as accepted, tasks go on the board of ${project}.`,
  editLater: "After you save, you can edit the fact or task a finding became.",
  editFact: "Edit the fact",
  editTask: "Edit the task",
  details: "More details",
  open: { mail: "Open the email", message: "Open in the chat" } as Record<string, string>,
  approveAllAbout: "What this button approves",
  kinds: { mail: "Email", message: "Message", meeting: "Meeting", note: "Note" } as Record<string, string>,
  edit: "Edit",
  editOf: (text: string) => `Edit the finding: ${text}`,
  fields: {
    title: "Title",
    statement: "Statement",
    body: "Text",
    name: "Name",
    reason: "Why",
    detail: "Detail",
    dueAt: "Due date",
  } as Record<string, string>,
  editNote: "Only this finding changes, before you decide on it. What it cites stays as it is.",
  emptyClears: "Leave it empty to clear it.",
  required: (field: string) => `${field} cannot be empty.`,
  saveEdit: "Save the change",
  cancel: "Cancel",
  stale:
    "These findings changed since you opened them, so they are shown again as they are now. Check them and decide again.",
}

const ru: typeof en = {
  decision: (text) => `Решение по: ${text}`,
  keep: "Одобрить",
  drop: "Отклонить",
  markAll: "Все находки",
  keepAll: "Одобрить все",
  dropAll: "Отклонить все",
  kindHint: {
    fact: "Факт: то, что агент предлагает запомнить.",
    task: "Задача: дело, которое агент предлагает создать.",
    other: "Другие метки говорят, что будет сохранено: счет, контакт, изменение задачи.",
  },
  save: (keep, drop) =>
    keep === 0
      ? `Сохранить: отклонить все ${drop}`
      : drop === 0
        ? `Сохранить: создать ${keep}`
        : `Сохранить: создать ${keep}, отклонить ${drop}`,
  saveNote: (mail, project) =>
    mail
      ? "Ничего не сохраняется, пока вы не нажмете «Сохранить». Каждая одобренная находка сохраняется так, как написано на ее метке. Никому ничего не отправляется."
      : `Ничего не создается, пока вы не нажмете «Сохранить». Факты сохраняются как принятые, задачи попадают на доску ${project}.`,
  editLater: "После сохранения можно изменить факт или задачу, которые получились из находки.",
  editFact: "Изменить факт",
  editTask: "Изменить задачу",
  details: "Подробнее",
  open: { mail: "Открыть письмо", message: "Открыть в чате" },
  approveAllAbout: "Что одобряет эта кнопка",
  kinds: { mail: "Письмо", message: "Сообщение", meeting: "Встреча", note: "Заметка" },
  edit: "Изменить",
  editOf: (text) => `Изменить находку: ${text}`,
  fields: {
    title: "Название",
    statement: "Утверждение",
    body: "Текст",
    name: "Имя",
    reason: "Почему",
    detail: "Подробности",
    dueAt: "Срок",
  },
  editNote: "Меняется только эта находка, до вашего решения. То, на что она ссылается, остается как есть.",
  emptyClears: "Оставьте пустым, чтобы убрать.",
  required: (field) => `Поле «${field}» не может быть пустым.`,
  saveEdit: "Сохранить изменение",
  cancel: "Отмена",
  stale:
    "Эти находки изменились, пока они были открыты. Они показаны заново такими, какие они сейчас. Проверьте их и решите снова.",
}

const es: typeof en = {
  decision: (text) => `Decisión sobre: ${text}`,
  keep: "Aprobar",
  drop: "Rechazar",
  markAll: "Todos los hallazgos",
  keepAll: "Aprobar todos",
  dropAll: "Rechazar todos",
  kindHint: {
    fact: "Hecho: algo que el agente propone recordar.",
    task: "Tarea: una tarea que el agente propone crear.",
    other: "Las demás etiquetas dicen qué se guarda: una factura, un contacto, un cambio en una tarea.",
  },
  save: (keep, drop) =>
    keep === 0
      ? `Guardar: rechazar los ${drop}`
      : drop === 0
        ? `Guardar: crear ${keep}`
        : `Guardar: crear ${keep}, rechazar ${drop}`,
  saveNote: (mail, project) =>
    mail
      ? "No se guarda nada hasta que pulses Guardar. Cada hallazgo aprobado se guarda como dice su etiqueta. No se envía nada a nadie."
      : `No se crea nada hasta que pulses Guardar. Los hechos quedan aceptados y las tareas van al tablero de ${project}.`,
  editLater: "Después de guardar, puedes editar el hecho o la tarea que resultó de un hallazgo.",
  editFact: "Editar el hecho",
  editTask: "Editar la tarea",
  details: "Más detalles",
  open: { mail: "Abrir el correo", message: "Abrir en el chat" },
  approveAllAbout: "Qué aprueba este botón",
  kinds: { mail: "Correo", message: "Mensaje", meeting: "Reunión", note: "Nota" },
  edit: "Editar",
  editOf: (text) => `Editar el hallazgo: ${text}`,
  fields: {
    title: "Título",
    statement: "Afirmación",
    body: "Texto",
    name: "Nombre",
    reason: "Por qué",
    detail: "Detalle",
    dueAt: "Fecha límite",
  },
  editNote: "Solo cambia este hallazgo, antes de que decidas. Lo que cita se queda como está.",
  emptyClears: "Déjalo vacío para quitarlo.",
  required: (field) => `«${field}» no puede quedar vacío.`,
  saveEdit: "Guardar el cambio",
  cancel: "Cancelar",
  stale:
    "Estos hallazgos cambiaron mientras estaban abiertos. Se muestran de nuevo como están ahora. Revísalos y decide otra vez.",
}

export const findingsMessages: Messages<typeof en> = { en, ru, es }
