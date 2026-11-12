import type { Messages } from "@/i18n"

const en = {
  addTitle: "Add a person",
  addHelp: "Someone known by name only, for example to give them a task before any message names them.",
  addHint: "Name, such as Anna Lee",
  add: "Add",
  addAnyway: "Add anyway",
  addNameNeeded: "Type the person's name.",
  addSimilar: "Already in Contacts with a name like this:",
  addSame: (name: string) =>
    `${name} is already in Contacts. Open the card below, or press Add anyway to add a second person.`,
  addSameMark: "same name",
  addCheckFailed: "Could not look for people with this name. You can still add the person.",
  addFailed: "Could not add the person.",
  added: (name: string) => `Added to Contacts: ${name}.`,
}

const ru: typeof en = {
  addTitle: "Добавить человека",
  addHelp: "Человек, известный только по имени: например, чтобы дать ему задачу до первого сообщения.",
  addHint: "Имя, например Анна Ли",
  add: "Добавить",
  addAnyway: "Всё равно добавить",
  addNameNeeded: "Введите имя человека.",
  addSimilar: "Похожие имена уже есть в контактах:",
  addSame: (name: string) =>
    `«${name}» уже есть в контактах. Откройте карточку ниже или нажмите «Всё равно добавить», чтобы завести второго человека.`,
  addSameMark: "то же имя",
  addCheckFailed: "Не удалось поискать людей с этим именем. Человека всё равно можно добавить.",
  addFailed: "Не удалось добавить человека.",
  added: (name: string) => `Добавлен в контакты: ${name}.`,
}

const es: typeof en = {
  addTitle: "Añadir una persona",
  addHelp: "Alguien conocido solo por su nombre, por ejemplo para darle una tarea antes de que un mensaje lo nombre.",
  addHint: "Nombre, como Ana López",
  add: "Añadir",
  addAnyway: "Añadir de todos modos",
  addNameNeeded: "Escribe el nombre de la persona.",
  addSimilar: "Ya hay en Contactos nombres parecidos:",
  addSame: (name: string) =>
    `${name} ya está en Contactos. Abre su ficha abajo o pulsa Añadir de todos modos para añadir otra persona.`,
  addSameMark: "mismo nombre",
  addCheckFailed: "No se pudo buscar personas con este nombre. Aún puedes añadir a la persona.",
  addFailed: "No se pudo añadir a la persona.",
  added: (name: string) => `Añadido a Contactos: ${name}.`,
}

/** Add a person, above the Contacts table. */
export const addPersonMessages: Messages<typeof en> = { en, ru, es }
