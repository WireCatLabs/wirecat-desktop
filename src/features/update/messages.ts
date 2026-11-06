import type { Messages } from "@/i18n"

type Package = "deb" | "rpm"

const en = {
  updating: "Updating…",
  updateTo: (version: string) => `Update to ${version}`,
  downloadingLabel: "Downloading the update",
  downloaded: (done: string, total: string) => `${done} of ${total}`,
  downloading: "Downloading the update…",
  later: "Later",
  hide: "Hide",
  close: "Close",
  tryAgain: "Try again",
  install: "Install and restart",
  downloadAndInstall: "Download and install",
  available: (version: string) => `WireCat ${version} is available`,
  auto: "WireCat downloads the update, installs it and opens again. Your accounts and data will not be deleted.",
  package: {
    deb: "This copy was installed from a .deb package (Ubuntu, Debian, Linux Mint). WireCat downloads the new package and opens your system's installer, which asks for your password. Your accounts and data will not be deleted.",
    rpm: "This copy was installed from an .rpm package (Fedora, openSUSE). WireCat downloads the new package and opens your system's installer, which asks for your password. Your accounts and data will not be deleted.",
  } satisfies Record<Package, string>,
  other:
    "WireCat cannot tell how this copy was installed, so it cannot update it. Get the new version from the download page and install it the way you installed this one. Your accounts and data will not be deleted.",
  howUpdates: "How updates work",
  openDownloadPage: "Open the download page",
  opened: (file: string) =>
    `The system installer opened ${file}. Enter your password there to install it, then open WireCat again.`,
  revealed: (file: string) =>
    `${file} is in your Downloads folder. Double-click it to open the installer, enter your password, then open WireCat again.`,
  terminal: {
    deb: "Or install it from a terminal. The command first copies the package into apt's own folder, because apt cannot read files in your home folder and would print a notice about it. Then it asks for your password, installs WireCat and prints the next steps.",
    rpm: "Or install it from a terminal. It asks for your password, installs WireCat and prints the next steps.",
  } satisfies Record<Package, string>,
  copyCommand: "Copy the command",
  openTerminal: "Open in terminal",
  terminalOpened:
    "Your terminal is open with this command. Type your password there. When the install finishes, close WireCat and open it again to use the new version.",
  terminalMissing: "WireCat could not open a terminal on this computer. Copy the command and run it in your terminal.",
  whatsNew: (version: string) => `What's new in ${version}`,
  allReleases: "All releases on GitHub",
  restarting: "Installed. WireCat is restarting…",
  rejected: "The download did not match WireCat's signature, so it was not opened.",
  rejectedDetail: "Nothing was saved. Try again later, or get WireCat from the download page.",
  failedDetail: "Try again, or get WireCat from the download page.",
  failed: "The update could not be installed.",
  offline: "WireCat could not reach the update server.",
  offlineNext: "Check your internet connection, then try again.",
  server: "GitHub, where WireCat keeps its updates, did not answer.",
  serverNext: "Try again in a few minutes.",
  diskFull: (folder: string) => `There is not enough free space in ${folder} for the update.`,
  diskFullNext: "Free some space on this disk, for example empty the Trash, then try again.",
  notWritable: (folder: string) => `WireCat cannot save the update in ${folder}.`,
  notWritableNext: "Make sure the folder exists and you can save files in it, then try again.",
  newer: (version: string) => `WireCat ${version} is out now.`,
  newerNext: "Close this window and open the update again.",
  details: (text: string) => `Details: ${text}`,
  keep: (path: string) =>
    `If you cancel the password prompt or close the installer, nothing is installed. The package stays at ${path}: open it again later, or use the command below.`,
}

const ru: typeof en = {
  updating: "Обновление…",
  updateTo: (version) => `Обновить до ${version}`,
  downloadingLabel: "Загрузка обновления",
  downloaded: (done, total) => `${done} из ${total}`,
  downloading: "Загружается обновление…",
  later: "Позже",
  hide: "Скрыть",
  close: "Закрыть",
  tryAgain: "Попробовать снова",
  install: "Установить и перезапустить",
  downloadAndInstall: "Скачать и установить",
  available: (version) => `Вышел WireCat ${version}`,
  auto: "WireCat скачает обновление, установит его и откроется снова. Ваши аккаунты и данные не удалятся.",
  package: {
    deb: "WireCat установлен из пакета .deb (Ubuntu, Debian, Linux Mint). Он скачает новый пакет и откроет установщик программ вашей системы — там нужно будет ввести пароль. Ваши аккаунты и данные не удалятся.",
    rpm: "WireCat установлен из пакета .rpm (Fedora, openSUSE). Он скачает новый пакет и откроет установщик программ вашей системы — там нужно будет ввести пароль. Ваши аккаунты и данные не удалятся.",
  },
  other:
    "WireCat не знает, как была установлена эта копия, поэтому не может её обновить. Скачайте новую версию на странице загрузки и установите её так же, как эту. Ваши аккаунты и данные не удалятся.",
  howUpdates: "Как устроены обновления",
  openDownloadPage: "Открыть страницу загрузки",
  opened: (file) =>
    `Файл ${file} открыт в установщике программ. Введите там пароль, а после установки снова откройте WireCat.`,
  revealed: (file) =>
    `${file} лежит в папке «Загрузки». Откройте его двойным щелчком, введите пароль, а после установки снова откройте WireCat.`,
  terminal: {
    deb: "Или установите из терминала. Команда сначала копирует пакет в собственную папку apt: apt не может читать файлы из вашей домашней папки и написал бы об этом предупреждение. Потом она спросит пароль, установит WireCat и покажет, что делать дальше.",
    rpm: "Или установите из терминала. Команда спросит пароль, установит WireCat и покажет, что делать дальше.",
  },
  copyCommand: "Скопировать команду",
  openTerminal: "Открыть в терминале",
  terminalOpened:
    "Терминал открыт с этой командой. Введите там пароль. Когда установка закончится, закройте WireCat и откройте снова, чтобы запустить новую версию.",
  terminalMissing:
    "WireCat не смог открыть терминал на этом компьютере. Скопируйте команду и выполните её в своём терминале.",
  whatsNew: (version) => `Что нового в ${version}`,
  allReleases: "Все выпуски на GitHub",
  restarting: "Установлено. WireCat перезапускается…",
  rejected: "Скачанный файл не прошёл проверку подписи WireCat, поэтому он не открыт.",
  rejectedDetail: "Ничего не сохранено. Попробуйте позже или скачайте WireCat на странице загрузки.",
  failedDetail: "Попробуйте снова или скачайте WireCat на странице загрузки.",
  failed: "Не удалось установить обновление.",
  offline: "WireCat не смог связаться с сервером обновлений.",
  offlineNext: "Проверьте подключение к интернету и попробуйте снова.",
  server: "GitHub, где лежат обновления WireCat, не ответил.",
  serverNext: "Попробуйте снова через несколько минут.",
  diskFull: (folder) => `В папке ${folder} не хватает места для обновления.`,
  diskFullNext: "Освободите место на диске, например очистите корзину, и попробуйте снова.",
  notWritable: (folder) => `WireCat не может сохранить обновление в папку ${folder}.`,
  notWritableNext: "Проверьте, что папка существует и вы можете сохранять в неё файлы, и попробуйте снова.",
  newer: (version) => `Уже вышел WireCat ${version}.`,
  newerNext: "Закройте это окно и откройте обновление снова.",
  details: (text) => `Подробности: ${text}`,
  keep: (path) =>
    `Если вы отмените ввод пароля или закроете установщик, ничего не установится. Пакет останется в ${path}: откройте его позже или используйте команду ниже.`,
}

const es: typeof en = {
  updating: "Actualizando…",
  updateTo: (version) => `Actualizar a ${version}`,
  downloadingLabel: "Descargando la actualización",
  downloaded: (done, total) => `${done} de ${total}`,
  downloading: "Descargando la actualización…",
  later: "Más tarde",
  hide: "Ocultar",
  close: "Cerrar",
  tryAgain: "Reintentar",
  install: "Instalar y reiniciar",
  downloadAndInstall: "Descargar e instalar",
  available: (version) => `WireCat ${version} ya está disponible`,
  auto: "WireCat descarga la actualización, la instala y se vuelve a abrir. Tus cuentas y tus datos no se borran.",
  package: {
    deb: "Esta copia se instaló con un paquete .deb (Ubuntu, Debian, Linux Mint). WireCat descarga el paquete nuevo y abre el instalador de tu sistema, que te pedirá la contraseña. Tus cuentas y tus datos no se borran.",
    rpm: "Esta copia se instaló con un paquete .rpm (Fedora, openSUSE). WireCat descarga el paquete nuevo y abre el instalador de tu sistema, que te pedirá la contraseña. Tus cuentas y tus datos no se borran.",
  },
  other:
    "WireCat no sabe cómo se instaló esta copia, así que no puede actualizarla. Descarga la versión nueva en la página de descargas e instálala como instalaste esta. Tus cuentas y tus datos no se borran.",
  howUpdates: "Cómo funcionan las actualizaciones",
  openDownloadPage: "Abrir la página de descargas",
  opened: (file) =>
    `El instalador del sistema ha abierto ${file}. Escribe ahí tu contraseña para instalarlo y luego vuelve a abrir WireCat.`,
  revealed: (file) =>
    `${file} está en tu carpeta Descargas. Ábrelo con doble clic, escribe tu contraseña y luego vuelve a abrir WireCat.`,
  terminal: {
    deb: "O instálalo desde una terminal. El comando primero copia el paquete a la carpeta propia de apt, porque apt no puede leer archivos de tu carpeta personal y mostraría un aviso. Después te pide la contraseña, instala WireCat y muestra los siguientes pasos.",
    rpm: "O instálalo desde una terminal. Te pide la contraseña, instala WireCat y muestra los siguientes pasos.",
  },
  copyCommand: "Copiar el comando",
  openTerminal: "Abrir en la terminal",
  terminalOpened:
    "Tu terminal está abierta con este comando. Escribe ahí tu contraseña. Cuando termine la instalación, cierra WireCat y vuelve a abrirlo para usar la versión nueva.",
  terminalMissing:
    "WireCat no ha podido abrir una terminal en este equipo. Copia el comando y ejecútalo en tu terminal.",
  whatsNew: (version) => `Novedades de la versión ${version}`,
  allReleases: "Todas las versiones en GitHub",
  restarting: "Instalada. WireCat se está reiniciando…",
  rejected: "La descarga no coincide con la firma de WireCat, así que no se ha abierto.",
  rejectedDetail: "No se ha guardado nada. Vuelve a intentarlo más tarde o descarga WireCat en la página de descargas.",
  failedDetail: "Vuelve a intentarlo o descarga WireCat en la página de descargas.",
  failed: "No se ha podido instalar la actualización.",
  offline: "WireCat no ha podido conectar con el servidor de actualizaciones.",
  offlineNext: "Comprueba tu conexión a internet y vuelve a intentarlo.",
  server: "GitHub, donde WireCat guarda sus actualizaciones, no ha respondido.",
  serverNext: "Vuelve a intentarlo dentro de unos minutos.",
  diskFull: (folder) => `No hay espacio libre suficiente en ${folder} para la actualización.`,
  diskFullNext: "Libera espacio en este disco, por ejemplo vaciando la papelera, y vuelve a intentarlo.",
  notWritable: (folder) => `WireCat no puede guardar la actualización en ${folder}.`,
  notWritableNext: "Comprueba que la carpeta existe y que puedes guardar archivos en ella, y vuelve a intentarlo.",
  newer: (version) => `Ya ha salido WireCat ${version}.`,
  newerNext: "Cierra esta ventana y vuelve a abrir la actualización.",
  details: (text) => `Detalles: ${text}`,
  keep: (path) =>
    `Si cancelas la contraseña o cierras el instalador, no se instala nada. El paquete se queda en ${path}: ábrelo más tarde o usa el comando de abajo.`,
}

export type UpdateMessages = typeof en
export const updateMessages: Messages<UpdateMessages> = { en, ru, es }
