import type { Messages } from "@/i18n"

const en = {
  decision: (text: string) => `Decision on: ${text}`,
  keep: "Approve",
  drop: "Reject",
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
  editLater: "memo cannot change a finding before it is saved. After saving, edit the fact or task it became.",
  editFact: "Edit the fact",
  editTask: "Edit the task",
  details: "More details",
  open: { mail: "Open the email", message: "Open in the chat" } as Record<string, string>,
  copyRef: "Copy the reference",
  approveAllAbout: "What this button approves",
  kinds: { mail: "Email", message: "Message", meeting: "Meeting", note: "Note" } as Record<string, string>,
}

const ru: typeof en = {
  decision: (text) => `Решение по: ${text}`,
  keep: "Одобрить",
  drop: "Отклонить",
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
  editLater:
    "memo не умеет менять находку до сохранения. После сохранения можно изменить факт или задачу, которые из нее получились.",
  editFact: "Изменить факт",
  editTask: "Изменить задачу",
  details: "Подробнее",
  open: { mail: "Открыть письмо", message: "Открыть в чате" },
  copyRef: "Скопировать ссылку",
  approveAllAbout: "Что одобряет эта кнопка",
  kinds: { mail: "Письмо", message: "Сообщение", meeting: "Встреча", note: "Заметка" },
}

const es: typeof en = {
  decision: (text) => `Decisión sobre: ${text}`,
  keep: "Aprobar",
  drop: "Rechazar",
  keepAll: "Aprobar todo",
  dropAll: "Rechazar todo",
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
  editLater:
    "memo no puede cambiar un hallazgo antes de guardarlo. Después puedes editar el hecho o la tarea que resultó.",
  editFact: "Editar el hecho",
  editTask: "Editar la tarea",
  details: "Más detalles",
  open: { mail: "Abrir el correo", message: "Abrir en el chat" },
  copyRef: "Copiar la referencia",
  approveAllAbout: "Qué aprueba este botón",
  kinds: { mail: "Correo", message: "Mensaje", meeting: "Reunión", note: "Nota" },
}

export const findingsMessages: Messages<typeof en> = { en, ru, es }
