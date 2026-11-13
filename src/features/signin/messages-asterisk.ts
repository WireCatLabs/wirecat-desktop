import type { Messages } from "@/i18n"

type Field = { label: string; hint: string }

const en = {
  pick: "Where are the call records?",
  sources: {
    csv: { name: "Master.csv file", detail: "Asterisk's CSV log, on this computer" },
    mysql: { name: "MySQL or MariaDB", detail: "The CDR database, such as FreePBX's asteriskcdrdb" },
    postgres: { name: "PostgreSQL", detail: "The CDR table in PostgreSQL" },
  } as Record<string, { name: string; detail: string }>,
  fields: {
    cdr_csv_path: {
      label: "Path of Master.csv",
      hint: "On the PBX it is usually /var/log/asterisk/cdr-csv/Master.csv. Copy it here or share its folder, then type its path on this computer.",
    },
    db_host: { label: "Database server", hint: "Its host name or IP address, as this computer reaches it." },
    db_port: { label: "Port (optional)", hint: "Leave empty for 3306 on MySQL or 5432 on PostgreSQL." },
    db_name: { label: "Database name", hint: "Often asteriskcdrdb." },
    db_user: { label: "User", hint: "A user that can only read the CDR table is enough." },
    db_tls: {
      label: "Encrypted connection",
      hint: "Checks the server's certificate. Turn it on when the database is not on your own network.",
    },
    recordings_path: {
      label: "Recordings folder (optional)",
      hint: "The call recordings on this computer, such as a copy of /var/spool/asterisk/monitor. Calls come in without it too.",
    },
  } as Record<string, Field>,
  chooseFolder: "Choose folder",
  password: "Password of the database user",
  show: "Show the password",
  hide: "Hide the password",
  needField: "Fill this in to go on.",
  portWrong: "A port is a number from 1 to 65535.",
  needPassword: "Type the database user's password first.",
  what: "What happens",
  steps: {
    csv: [
      "asterisk reads the newest hour of Master.csv to check the path. It changes nothing.",
      "Sync then brings in the calls of the last 30 days as meetings, with their recordings.",
    ],
    db: [
      "asterisk connects with this user and reads the newest hour of calls. It changes nothing.",
      "The password is kept only once that check works.",
      "Sync then brings in the calls of the last 30 days as meetings, with their recordings.",
    ],
  },
  kept: {
    csv: [
      "Read only: asterisk never changes Master.csv or the recordings.",
      "The calls are copied to this computer only.",
    ],
    db: [
      "The password goes straight to asterisk and is kept in your system's password store, or in the tool's own folder when there is none.",
      "Read only: asterisk never writes to the database.",
      "The calls are copied to this computer only.",
    ],
  },
  more: "The time zone of the records, the country of local numbers and the recordings' file names are on the Settings page.",
  transcribe: (profile: string) =>
    `To turn recordings into text, run in a terminal once: asterisk models download gigaam-v3, then asterisk ${profile} meetings transcribe. WAV and GSM recordings need ffmpeg.`,
}

export type AsteriskText = typeof en

const ru: AsteriskText = {
  pick: "Где записи о звонках?",
  sources: {
    csv: { name: "Файл Master.csv", detail: "CSV-журнал Asterisk на этом компьютере" },
    mysql: { name: "MySQL или MariaDB", detail: "База CDR, например asteriskcdrdb во FreePBX" },
    postgres: { name: "PostgreSQL", detail: "Таблица CDR в PostgreSQL" },
  },
  fields: {
    cdr_csv_path: {
      label: "Путь к Master.csv",
      hint: "На АТС он обычно лежит в /var/log/asterisk/cdr-csv/Master.csv. Скопируйте его сюда или откройте общий доступ к папке и укажите путь на этом компьютере.",
    },
    db_host: {
      label: "Сервер базы данных",
      hint: "Имя хоста или IP-адрес, по которому до него доходит этот компьютер.",
    },
    db_port: { label: "Порт (необязательно)", hint: "Оставьте пустым для 3306 в MySQL или 5432 в PostgreSQL." },
    db_name: { label: "Имя базы", hint: "Часто asteriskcdrdb." },
    db_user: { label: "Пользователь", hint: "Достаточно пользователя, который может только читать таблицу CDR." },
    db_tls: {
      label: "Шифрованное соединение",
      hint: "Проверяет сертификат сервера. Включите, если база не в вашей собственной сети.",
    },
    recordings_path: {
      label: "Папка с записями (необязательно)",
      hint: "Записи звонков на этом компьютере, например копия /var/spool/asterisk/monitor. Звонки придут и без неё.",
    },
  },
  chooseFolder: "Выбрать папку",
  password: "Пароль пользователя базы",
  show: "Показать пароль",
  hide: "Скрыть пароль",
  needField: "Заполните, чтобы продолжить.",
  portWrong: "Порт — это число от 1 до 65535.",
  needPassword: "Сначала введите пароль пользователя базы.",
  what: "Что произойдёт",
  steps: {
    csv: [
      "asterisk прочитает последний час Master.csv, чтобы проверить путь. Он ничего не меняет.",
      "Затем синхронизация загрузит звонки за последние 30 дней как встречи, вместе с записями.",
    ],
    db: [
      "asterisk подключится под этим пользователем и прочитает звонки за последний час. Он ничего не меняет.",
      "Пароль сохраняется только после успешной проверки.",
      "Затем синхронизация загрузит звонки за последние 30 дней как встречи, вместе с записями.",
    ],
  },
  kept: {
    csv: ["Только чтение: asterisk не меняет Master.csv и записи.", "Звонки копируются только на этот компьютер."],
    db: [
      "Пароль передаётся прямо в asterisk и хранится в системном хранилище паролей, а если его нет — в папке инструмента.",
      "Только чтение: asterisk ничего не пишет в базу.",
      "Звонки копируются только на этот компьютер.",
    ],
  },
  more: "Часовой пояс записей, страна местных номеров и имена файлов записей — на странице «Настройки».",
  transcribe: (profile) =>
    `Чтобы превратить записи в текст, один раз выполните в терминале: asterisk models download gigaam-v3, затем asterisk ${profile} meetings transcribe. Для записей WAV и GSM нужен ffmpeg.`,
}

const es: AsteriskText = {
  pick: "¿Dónde están los registros de llamadas?",
  sources: {
    csv: { name: "Archivo Master.csv", detail: "El registro CSV de Asterisk, en este equipo" },
    mysql: { name: "MySQL o MariaDB", detail: "La base de datos CDR, como asteriskcdrdb de FreePBX" },
    postgres: { name: "PostgreSQL", detail: "La tabla CDR en PostgreSQL" },
  },
  fields: {
    cdr_csv_path: {
      label: "Ruta de Master.csv",
      hint: "En la centralita suele estar en /var/log/asterisk/cdr-csv/Master.csv. Cópialo aquí o comparte su carpeta, y escribe su ruta en este equipo.",
    },
    db_host: {
      label: "Servidor de la base de datos",
      hint: "Su nombre de host o dirección IP, tal como llega este equipo.",
    },
    db_port: { label: "Puerto (opcional)", hint: "Déjalo vacío para 3306 en MySQL o 5432 en PostgreSQL." },
    db_name: { label: "Nombre de la base de datos", hint: "A menudo asteriskcdrdb." },
    db_user: { label: "Usuario", hint: "Basta un usuario que solo pueda leer la tabla CDR." },
    db_tls: {
      label: "Conexión cifrada",
      hint: "Comprueba el certificado del servidor. Actívala si la base de datos no está en tu propia red.",
    },
    recordings_path: {
      label: "Carpeta de grabaciones (opcional)",
      hint: "Las grabaciones de llamadas en este equipo, como una copia de /var/spool/asterisk/monitor. Las llamadas llegan también sin ella.",
    },
  },
  chooseFolder: "Elegir carpeta",
  password: "Contraseña del usuario de la base de datos",
  show: "Mostrar la contraseña",
  hide: "Ocultar la contraseña",
  needField: "Rellena esto para continuar.",
  portWrong: "Un puerto es un número del 1 al 65535.",
  needPassword: "Escribe primero la contraseña del usuario de la base de datos.",
  what: "Qué pasará",
  steps: {
    csv: [
      "asterisk lee la última hora de Master.csv para comprobar la ruta. No cambia nada.",
      "Después, la sincronización trae las llamadas de los últimos 30 días como reuniones, con sus grabaciones.",
    ],
    db: [
      "asterisk se conecta con este usuario y lee las llamadas de la última hora. No cambia nada.",
      "La contraseña se guarda solo cuando esa comprobación funciona.",
      "Después, la sincronización trae las llamadas de los últimos 30 días como reuniones, con sus grabaciones.",
    ],
  },
  kept: {
    csv: [
      "Solo lectura: asterisk nunca cambia Master.csv ni las grabaciones.",
      "Las llamadas se copian solo a este equipo.",
    ],
    db: [
      "La contraseña va directa a asterisk y se guarda en el almacén de contraseñas del sistema, o en la carpeta de la herramienta si no hay ninguno.",
      "Solo lectura: asterisk nunca escribe en la base de datos.",
      "Las llamadas se copian solo a este equipo.",
    ],
  },
  more: "La zona horaria de los registros, el país de los números locales y los nombres de archivo de las grabaciones están en la página Ajustes.",
  transcribe: (profile) =>
    `Para pasar las grabaciones a texto, ejecuta una vez en un terminal: asterisk models download gigaam-v3, y después asterisk ${profile} meetings transcribe. Las grabaciones WAV y GSM necesitan ffmpeg.`,
}

export const asteriskMessages: Messages<AsteriskText> = { en, ru, es }
