import type { Messages } from "@/i18n"

const en = {
  zoom: {
    askTitle: "Your Zoom app's Public Client ID",
    askLead:
      "Zoom lets a program in only through an app you make once. Make it with the steps below, then paste its ID.",
    copyRequired: (n: number) => `Copy all ${n}`,
    optional: (n: number) => `${n} more, only for other zm features`,
    loading: "Asking zm what the app needs…",
  },
  mail: {
    serverHint: {
      imap_host: "For example imap.example.com. Your mail service's help page names it.",
      imap_port: "Leave empty for 993.",
      smtp_host: "Leave empty to only read mail.",
      smtp_port: "Leave empty for 465.",
    } as Record<string, string>,
    serverEmpty: "Type the server's name first.",
    portWrong: "A port is a number from 1 to 65535.",
    prepare: "Before the password",
  },
  wa: {
    phoneHint:
      "With + and the country code, for example +34 612 345 678. WhatsApp then shows a code to type on the phone.",
    phonePreview: (phone: string) => `WhatsApp gets ${phone}.`,
  },
}

export type SetupText = typeof en

const ru: SetupText = {
  zoom: {
    askTitle: "Public Client ID вашего приложения Zoom",
    askLead:
      "Zoom пускает программу только через приложение, которое вы создаёте один раз. Создайте его по шагам ниже и вставьте его ID.",
    copyRequired: (n) => `Скопировать все (${n})`,
    optional: (n) => `Ещё ${n}, только для других функций zm`,
    loading: "Спрашиваю у zm, что нужно приложению…",
  },
  mail: {
    serverHint: {
      imap_host: "Например, imap.example.com. Он указан в справке вашей почты.",
      imap_port: "Оставьте пустым для 993.",
      smtp_host: "Оставьте пустым, чтобы только читать почту.",
      smtp_port: "Оставьте пустым для 465.",
    },
    serverEmpty: "Сначала введите имя сервера.",
    portWrong: "Порт — число от 1 до 65535.",
    prepare: "Перед паролем",
  },
  wa: {
    phoneHint:
      "С + и кодом страны, например +7 912 345 6789. Затем WhatsApp покажет код, который нужно ввести на телефоне.",
    phonePreview: (phone) => `WhatsApp получит ${phone}.`,
  },
}

const es: SetupText = {
  zoom: {
    askTitle: "El Public Client ID de tu app de Zoom",
    askLead:
      "Zoom deja entrar a un programa solo mediante una app que creas una vez. Créala con los pasos de abajo y pega su ID.",
    copyRequired: (n) => `Copiar los ${n}`,
    optional: (n) => `${n} más, solo para otras funciones de zm`,
    loading: "Preguntando a zm qué necesita la app…",
  },
  mail: {
    serverHint: {
      imap_host: "Por ejemplo imap.example.com. Lo indica la ayuda de tu servicio de correo.",
      imap_port: "Déjalo vacío para 993.",
      smtp_host: "Déjalo vacío para solo leer el correo.",
      smtp_port: "Déjalo vacío para 465.",
    },
    serverEmpty: "Escribe primero el nombre del servidor.",
    portWrong: "Un puerto es un número del 1 al 65535.",
    prepare: "Antes de la contraseña",
  },
  wa: {
    phoneHint:
      "Con + y el prefijo del país, por ejemplo +34 612 345 678. Después WhatsApp muestra un código para escribir en el teléfono.",
    phonePreview: (phone) => `WhatsApp recibe ${phone}.`,
  },
}

export const setupMessages: Messages<SetupText> = { en, ru, es }
