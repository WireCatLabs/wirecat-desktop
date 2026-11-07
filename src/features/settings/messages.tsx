import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

const en = {
  title: "Settings",
  intro: "How WireCat looks on this computer, and the settings of each tool.",
  app: "WireCat",
  size: "Interface size",
  sizeHelp: (mod: string) =>
    `Text and everything around it. ${mod} + and ${mod} − change it anywhere in the app, ${mod} 0 resets it.`,
  reset: "Reset to default",
  language: "Language",
  languageHelp: "Tool names, commands and what the tools print stay as they are.",
  system: (name: string) => `System (${name})`,
  tools: "Tools",
  toolsIntro: (command: ReactNode): ReactNode => (
    <>
      Read from the tools and saved through their own {command}, so every value is checked by the tool before it is
      written.
    </>
  ),
  tool: "Tool",
  community: "Enable community tools",
  communityInfo: "About community tools",
  communityHow: "How to make your own",
  communityHelp:
    "Tools made outside WireCat, from a list WireCat reviews and signs. The review checks how a tool is built and " +
    "released, not everything it does: installing one runs its code on this computer, as any npm package does. " +
    "Install only the ones whose makers you trust.",
  communityNoKey: "This copy of WireCat cannot read the list yet.",
  communityOnNext: "Community tools appear the next time WireCat starts.",
  communityOffNext: "Community tools disappear the next time WireCat starts. Installed ones stay installed.",
  own: "Allow tools WireCat has not checked",
  ownInfo: "About tools WireCat has not checked",
  ownHelp:
    "Adds Add your own tool to the Tools page: any tool built for WireCat, added by its npm name. WireCat does not " +
    "review these tools.",
  ownWarnTitle: "Allow tools WireCat has not checked?",
  ownWarn: [
    "A tool you add this way gets access to all your personal data that WireCat holds: your messages, mail, notes and files.",
    "Add only tools whose authors you trust completely.",
    "WireCat has not checked these tools and takes no responsibility for what they do.",
  ],
  ownAllow: "Allow",
  cancel: "Cancel",
  ownOnNext: "Add your own tool is now on the Tools page. Tools you added appear the next time WireCat starts.",
  ownOffNext: "Your own tools disappear the next time WireCat starts. Installed ones stay installed.",
  ownFlag: "WIRECAT_EXTRA_TOOLS=1 is set, so your own tools are read whatever this switch says.",
  ownDocs: "How it works",
  leftOut: "Left out when WireCat started:",
  restart: "Restart now",
}

const ru: typeof en = {
  title: "Настройки",
  intro: "Как WireCat выглядит на этом компьютере и настройки каждого инструмента.",
  app: "WireCat",
  size: "Размер интерфейса",
  sizeHelp: (mod) => `Текст и всё вокруг него. ${mod} + и ${mod} − меняют размер в любом месте, ${mod} 0 сбрасывает.`,
  reset: "Сбросить",
  language: "Язык",
  languageHelp: "Названия инструментов, команды и то, что выводят сами инструменты, не переводятся.",
  system: (name) => `Как в системе (${name})`,
  tools: "Инструменты",
  toolsIntro: (command) => (
    <>
      Читаются из инструментов и сохраняются их собственной командой {command}, поэтому инструмент проверяет каждое
      значение перед записью.
    </>
  ),
  tool: "Инструмент",
  community: "Включить инструменты сообщества",
  communityInfo: "Об инструментах сообщества",
  communityHow: "Как сделать свой",
  communityHelp:
    "Инструменты, сделанные не в WireCat, из списка, который WireCat проверяет и подписывает. Проверка смотрит, как " +
    "инструмент собран и выпущен, а не всё, что он делает: установка запускает его код на этом компьютере, как у " +
    "любого пакета npm. Устанавливайте только те, чьим авторам доверяете.",
  communityNoKey: "Эта копия WireCat пока не может прочитать список.",
  communityOnNext: "Инструменты сообщества появятся при следующем запуске WireCat.",
  communityOffNext: "Инструменты сообщества исчезнут при следующем запуске WireCat. Установленные останутся.",
  own: "Разрешить инструменты, которые WireCat не проверял",
  ownInfo: "Об инструментах, которые WireCat не проверял",
  ownHelp:
    "Добавляет на страницу «Инструменты» кнопку «Добавить свой инструмент»: любой инструмент для WireCat по его " +
    "имени в npm. WireCat такие инструменты не проверяет.",
  ownWarnTitle: "Разрешить инструменты, которые WireCat не проверял?",
  ownWarn: [
    "Инструмент, добавленный так, получает доступ ко всем вашим личным данным в WireCat: сообщениям, почте, заметкам и файлам.",
    "Добавляйте только инструменты авторов, которым полностью доверяете.",
    "WireCat не проверял эти инструменты и не отвечает за то, что они делают.",
  ],
  ownAllow: "Разрешить",
  cancel: "Отмена",
  ownOnNext:
    "Кнопка «Добавить свой инструмент» уже на странице «Инструменты». Добавленные инструменты появятся при следующем запуске WireCat.",
  ownOffNext: "Ваши инструменты исчезнут при следующем запуске WireCat. Установленные останутся.",
  ownFlag: "Задано WIRECAT_EXTRA_TOOLS=1, поэтому ваши инструменты читаются при любом положении переключателя.",
  ownDocs: "Как это работает",
  leftOut: "Не добавлены при запуске WireCat:",
  restart: "Перезапустить",
}

const es: typeof en = {
  title: "Ajustes",
  intro: "Cómo se ve WireCat en este ordenador y los ajustes de cada herramienta.",
  app: "WireCat",
  size: "Tamaño de la interfaz",
  sizeHelp: (mod) =>
    `El texto y todo lo que lo rodea. ${mod} + y ${mod} − lo cambian en cualquier parte, ${mod} 0 lo restablece.`,
  reset: "Restablecer",
  language: "Idioma",
  languageHelp: "Los nombres de las herramientas, los comandos y lo que imprimen las herramientas no se traducen.",
  system: (name) => `Sistema (${name})`,
  tools: "Herramientas",
  toolsIntro: (command) => (
    <>
      Se leen de las herramientas y se guardan con su propio {command}, así que la herramienta comprueba cada valor
      antes de escribirlo.
    </>
  ),
  tool: "Herramienta",
  community: "Activar herramientas de la comunidad",
  communityInfo: "Sobre las herramientas de la comunidad",
  communityHow: "Cómo crear el tuyo",
  communityHelp:
    "Herramientas hechas fuera de WireCat, de una lista que WireCat revisa y firma. La revisión comprueba cómo se " +
    "construye y publica una herramienta, no todo lo que hace: instalarla ejecuta su código en este ordenador, como " +
    "cualquier paquete de npm. Instala solo las de autores en quienes confíes.",
  communityNoKey: "Esta copia de WireCat aún no puede leer la lista.",
  communityOnNext: "Las herramientas de la comunidad aparecerán la próxima vez que se inicie WireCat.",
  communityOffNext:
    "Las herramientas de la comunidad desaparecerán la próxima vez que se inicie WireCat. Las instaladas se quedan.",
  own: "Permitir herramientas que WireCat no ha revisado",
  ownInfo: "Sobre las herramientas que WireCat no ha revisado",
  ownHelp:
    "Añade el botón Añadir tu propia herramienta a la página Herramientas: cualquier herramienta hecha para WireCat, " +
    "por su nombre en npm. WireCat no revisa estas herramientas.",
  ownWarnTitle: "¿Permitir herramientas que WireCat no ha revisado?",
  ownWarn: [
    "Una herramienta añadida así obtiene acceso a todos tus datos personales en WireCat: tus mensajes, correo, notas y archivos.",
    "Añade solo herramientas de autores en quienes confíes por completo.",
    "WireCat no ha revisado estas herramientas y no se hace responsable de lo que hagan.",
  ],
  ownAllow: "Permitir",
  cancel: "Cancelar",
  ownOnNext:
    "Añadir tu propia herramienta ya está en la página Herramientas. Las herramientas añadidas aparecerán la próxima vez que se inicie WireCat.",
  ownOffNext: "Tus herramientas desaparecerán la próxima vez que se inicie WireCat. Las instaladas se quedan.",
  ownFlag: "WIRECAT_EXTRA_TOOLS=1 está definido, así que tus herramientas se leen sea cual sea este interruptor.",
  ownDocs: "Cómo funciona",
  leftOut: "Excluidas al iniciar WireCat:",
  restart: "Reiniciar ahora",
}

export const settingsMessages: Messages<typeof en> = { en, ru, es }
