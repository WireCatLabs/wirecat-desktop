import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

/** What the PATH fix says once a new terminal still misses the tools: the shell question, then the line by hand. */
const en = {
  stillMissing: (tools: string) => `A new terminal still does not find ${tools}.`,
  pickedMisses: (shell: string, tools: string) => `A new ${shell} terminal still does not find ${tools}.`,
  shellsLead: "WireCat added the line to these files, then opened each shell to check:",
  shellsLabel: "Shells WireCat checked",
  finds: "finds them",
  misses: "does not find them",
  silent: "did not answer",
  terminal: "your terminal",
  pickTitle: "Which shell does your terminal run?",
  pickHint:
    "A terminal app can start a different shell than your account lists. Pick the one yours runs: WireCat adds the line to its file and checks again.",
  checking: (shell: string) => `Checking ${shell}…`,
  byHand: "I will add the line myself",
  manualTo: (file: string | null) =>
    file ? `Add this line at the end of ${file}:` : "Add this line at the end of your shell's startup file:",
  manualWindows:
    "Add this folder to Path in your user's environment variables (Settings › System › About › Advanced system settings › Environment Variables):",
  tryIt: (command: ReactNode): ReactNode => (
    <>Then open a new terminal and run {command}. It prints a version number once the tool is found.</>
  ),
  whyTitle: "If it still says “command not found”:",
  why: [
    "A line further down the same file sets PATH again and drops the folder. Move WireCat's line to the very end.",
    "The terminal app is set to start another shell or a command. Check the shell or command in its profile settings.",
    "The terminal starts a login shell that does not read this file. Login bash reads ~/.bash_profile, so add the line there too.",
  ],
}

const ru: typeof en = {
  stillMissing: (tools: string) => `Новый терминал всё ещё не находит ${tools}.`,
  pickedMisses: (shell: string, tools: string) => `Новый терминал с ${shell} всё ещё не находит ${tools}.`,
  shellsLead: "WireCat добавил строку в эти файлы и открыл каждую оболочку, чтобы проверить:",
  shellsLabel: "Оболочки, которые проверил WireCat",
  finds: "находит",
  misses: "не находит",
  silent: "не ответила",
  terminal: "ваш терминал",
  pickTitle: "Какую оболочку запускает ваш терминал?",
  pickHint:
    "Приложение-терминал может запускать не ту оболочку, что указана в учётной записи. Выберите свою: WireCat добавит строку в её файл и проверит снова.",
  checking: (shell: string) => `Проверяем ${shell}…`,
  byHand: "Я добавлю строку сам",
  manualTo: (file: string | null) =>
    file ? `Добавьте эту строку в конец ${file}:` : "Добавьте эту строку в конец файла запуска вашей оболочки:",
  manualWindows:
    "Добавьте эту папку в Path в переменных среды пользователя (Параметры › Система › О системе › Дополнительные параметры системы › Переменные среды):",
  tryIt: (command: ReactNode): ReactNode => (
    <>Затем откройте новый терминал и выполните {command}. Когда инструмент найден, команда выводит номер версии.</>
  ),
  whyTitle: "Если терминал всё ещё пишет «command not found»:",
  why: [
    "Строка ниже в том же файле задаёт PATH заново и убирает папку. Перенесите строку WireCat в самый конец.",
    "Терминал настроен запускать другую оболочку или команду. Проверьте оболочку или команду в настройках его профиля.",
    "Терминал запускает оболочку входа, которая не читает этот файл. bash при входе читает ~/.bash_profile, добавьте строку и туда.",
  ],
}

const es: typeof en = {
  stillMissing: (tools: string) => `Un terminal nuevo sigue sin encontrar ${tools}.`,
  pickedMisses: (shell: string, tools: string) => `Un terminal nuevo con ${shell} sigue sin encontrar ${tools}.`,
  shellsLead: "WireCat añadió la línea a estos archivos y abrió cada shell para comprobarlo:",
  shellsLabel: "Shells que WireCat comprobó",
  finds: "las encuentra",
  misses: "no las encuentra",
  silent: "no respondió",
  terminal: "tu terminal",
  pickTitle: "¿Qué shell abre tu terminal?",
  pickHint:
    "Una app de terminal puede abrir un shell distinto del que indica tu cuenta. Elige el que abre la tuya: WireCat añade la línea a su archivo y vuelve a comprobar.",
  checking: (shell: string) => `Comprobando ${shell}…`,
  byHand: "Añadiré la línea yo",
  manualTo: (file: string | null) =>
    file ? `Añade esta línea al final de ${file}:` : "Añade esta línea al final del archivo de inicio de tu shell:",
  manualWindows:
    "Añade esta carpeta a Path en las variables de entorno de tu usuario (Configuración › Sistema › Información › Configuración avanzada del sistema › Variables de entorno):",
  tryIt: (command: ReactNode): ReactNode => (
    <>
      Después abre un terminal nuevo y ejecuta {command}. Muestra un número de versión cuando encuentra la herramienta.
    </>
  ),
  whyTitle: "Si sigue diciendo «command not found»:",
  why: [
    "Una línea más abajo en el mismo archivo vuelve a fijar PATH y quita la carpeta. Mueve la línea de WireCat al final.",
    "La app de terminal está configurada para abrir otro shell o un comando. Revisa el shell o el comando en la configuración de su perfil.",
    "El terminal abre un shell de inicio de sesión que no lee este archivo. bash de inicio de sesión lee ~/.bash_profile: añade la línea también ahí.",
  ],
}

export type PathFixMessages = typeof en

export const pathFixMessages: Messages<PathFixMessages> = { en, ru, es }
