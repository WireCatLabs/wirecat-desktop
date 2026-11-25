// What signing in to each tool gives and asks, in Russian and Spanish, by catalog id; English is the catalog's own.

export const RU_GIVES: Record<string, string> = {
  tg: "Агент сможет читать ваши чаты в Telegram, искать в них и отправлять сообщения, когда вы попросите.",
  max: "Агент сможет читать ваши чаты в MAX, искать в них и отправлять сообщения, когда вы попросите.",
  wa: "Агент сможет читать ваши чаты в WhatsApp, искать в них и отправлять сообщения, когда вы попросите.",
  slk: "Агент сможет читать и писать в вашем рабочем пространстве Slack от вашего имени.",
  zm: "Агент сможет находить ваши встречи в Zoom и читать их расшифровки и итоги.",
  drive: "Агент сможет находить и читать ваши файлы на Google Drive. Изменять их он не сможет.",
  gcal: "Агент сможет находить и читать события вашего Google Календаря. Изменять календарь он не сможет.",
  email:
    "Агент сможет искать и читать вашу почту на этом компьютере. Синхронизация копирует почту сюда и никогда не меняет ваш ящик.",
  notion: "Агент сможет читать страницы и базы данных Notion, которые видит ваш токен.",
  ydisk: "Агент сможет искать и читать выбранные папки Яндекс Диска и работать с файлами в пределах прав токена.",
  bitrix: "Агент сможет читать и менять CRM портала с правами сотрудника, который создал вебхук.",
  amo: "Агент сможет читать и менять CRM аккаунта с правами администратора, который создал токен.",
  attio: "Агент сможет читать сделки, людей и компании рабочего пространства с правами токена.",
  hubspot: "Агент сможет читать CRM аккаунта, а менять его, если вы дадите ключу права на запись.",
  linear: "Агент сможет читать ваши задачи, проекты и комментарии в Linear и менять их, когда вы разрешите.",
  wordpress:
    "Агент сможет читать записи и страницы вашего WordPress, писать черновики и публиковать, когда вы разрешите.",
  pbx: "Агент сможет находить телефонные звонки вашей компании и читать, что в них было сказано.",
}

export const RU_ASKS: Record<string, string> = {
  tg: "В первый раз — номер телефона и код, который пришлёт Telegram: так регистрируется ваше собственное приложение Telegram. Затем QR-код, который нужно отсканировать в Telegram: «Настройки → Устройства → Подключить устройство».",
  max: "QR-код, который нужно отсканировать приложением MAX на телефоне.",
  wa: "QR-код, который нужно отсканировать в WhatsApp: «Настройки → Связанные устройства → Привязка устройства».",
  slk: "User OAuth Token (xoxp-) приложения Slack, которое вы создаёте в своём рабочем пространстве по манифесту из slk.",
  zm: "Браузер откроет Zoom, чтобы вы разрешили доступ. Сначала Zoom нужно ваше собственное приложение, которое один раз создаётся в Zoom App Marketplace.",
  drive: "Браузер откроет Google: выберите аккаунт и разрешите доступ к Drive только на чтение.",
  gcal: "Браузер откроет Google: выберите аккаунт и разрешите доступ к Календарю только на чтение.",
  email:
    "Ваш адрес почты, затем вход Microsoft в браузере или пароль приложения — отдельный пароль только для этой программы.",
  notion: "Личный токен доступа Notion или токен внутреннего подключения, которое вы создали в Notion.",
  ydisk:
    "OAuth-токен Яндекса от приложения, которое вы один раз регистрируете на oauth.yandex.ru с доступом к Яндекс Диску.",
  bitrix:
    "Адрес входящего вебхука: «Разработчикам → Другое → Входящий вебхук», с правами crm, user_basic и department, task для задач, telephony для звонков, disk и documentgenerator для файлов. Или ID и ключ локального приложения, вход в браузере.",
  amo: "Адрес аккаунта и долгосрочный токен закрытой интеграции, которую администратор создаёт в amoCRM или Kommo.",
  attio:
    "Токен доступа: в Attio «Workspace settings → Developers → New access token», с правом чтения записей, настроек объектов и пользователей. Создать его может только администратор рабочего пространства.",
  hubspot:
    "Сервисный ключ или токен доступа старого приватного приложения из вашего аккаунта HubSpot, с правами на чтение, а для изменений и на запись.",
  linear:
    "Личный API-ключ из настроек Linear «Settings → Account → Security & access». Для синхронизации хватает права «Read»; чтобы агент менял задачи, нужно «Write».",
  wordpress:
    "Адрес сайта, имя пользователя и пароль приложения: в WordPress «Пользователи → Профиль → Пароли приложений». WordPress 5.7 или новее, по https.",
  pbx: "Путь к Master.csv или адрес базы CDR и пароль пользователя, который может только читать.",
}

export const ES_GIVES: Record<string, string> = {
  tg: "Tu agente podrá leer y buscar en tus chats de Telegram, y enviar mensajes cuando se lo pidas.",
  max: "Tu agente podrá leer y buscar en tus chats de MAX, y enviar mensajes cuando se lo pidas.",
  wa: "Tu agente podrá leer y buscar en tus chats de WhatsApp, y enviar mensajes cuando se lo pidas.",
  slk: "Tu agente podrá leer y escribir en tu espacio de trabajo de Slack en tu nombre.",
  zm: "Tu agente podrá encontrar tus reuniones de Zoom y leer sus transcripciones y resúmenes.",
  drive: "Tu agente podrá encontrar y leer tus archivos de Google Drive. No puede cambiarlos.",
  gcal: "Tu agente podrá encontrar y leer los eventos de tu Google Calendar. No puede cambiar tu calendario.",
  email:
    "Tu agente podrá buscar y leer tu correo en este equipo. La sincronización copia el correo aquí y nunca cambia tu buzón.",
  notion: "Tu agente podrá leer las páginas y bases de datos de Notion que ve tu token.",
  ydisk:
    "Tu agente podrá buscar y leer las carpetas de Yandex Disk que elijas, y trabajar con tus archivos hasta donde permita el token.",
  bitrix: "Tu agente podrá leer y cambiar el CRM del portal con los permisos del empleado que creó el webhook.",
  amo: "Tu agente podrá leer y cambiar el CRM de la cuenta con los permisos del administrador que creó el token.",
  attio:
    "Tu agente podrá leer las negociaciones, personas y empresas del espacio de trabajo con los permisos del token.",
  hubspot: "Tu agente podrá leer el CRM de la cuenta, y cambiarlo si le das a la clave los permisos de escritura.",
  linear: "Tu agente podrá leer tus incidencias, proyectos y comentarios de Linear, y cambiarlos cuando lo permitas.",
  wordpress:
    "Tu agente podrá leer las entradas y páginas de tu WordPress, escribir borradores y publicar cuando lo permitas.",
  pbx: "Tu agente podrá encontrar las llamadas de tu empresa y leer lo que se dijo en ellas.",
}

export const ES_ASKS: Record<string, string> = {
  tg: "La primera vez, tu número de teléfono y el código que envía Telegram, para registrar tu propia app de Telegram. Después, un código QR que escaneas en Telegram: Ajustes → Dispositivos → Vincular dispositivo.",
  max: "Un código QR que escaneas con la app de MAX en tu móvil.",
  wa: "Un código QR que escaneas en WhatsApp: Ajustes → Dispositivos vinculados → Vincular un dispositivo.",
  slk: "El User OAuth Token (xoxp-) de una app de Slack que creas en tu espacio de trabajo con el manifiesto que da slk.",
  zm: "Tu navegador abre Zoom para que apruebes el acceso. Antes, Zoom necesita una app tuya, que se crea una sola vez en el Zoom App Marketplace.",
  drive: "Tu navegador abre Google: elige la cuenta y permite el acceso de solo lectura a Drive.",
  gcal: "Tu navegador abre Google: elige la cuenta y permite el acceso de solo lectura a Calendar.",
  email:
    "Tu dirección de correo, y después el inicio de sesión de Microsoft en el navegador o una contraseña de aplicación: una contraseña solo para este programa.",
  notion: "Un token de acceso personal de Notion, o el token de una conexión interna que creaste en Notion.",
  ydisk:
    "Un token OAuth de Yandex, de una aplicación que registras una vez en oauth.yandex.ru con acceso a Yandex Disk.",
  bitrix:
    "La dirección de un webhook entrante, de Recursos para desarrolladores → Otros → Webhook entrante, con los permisos crm, user_basic y department, task para las tareas, telephony para las llamadas, y disk y documentgenerator para los archivos. O el ID y la clave de una aplicación local, con inicio de sesión en el navegador.",
  amo: "La dirección de la cuenta y un token de larga duración, de una integración privada que un administrador crea en amoCRM o Kommo.",
  attio:
    "Un token de acceso: en Attio, Workspace settings → Developers → New access token, con lectura de registros, configuración de objetos y gestión de usuarios. Solo un administrador del espacio de trabajo puede crearlo.",
  hubspot:
    "Una clave de servicio o el token de acceso de una aplicación privada antigua de tu cuenta de HubSpot, con permisos de lectura, y de escritura si quieres cambios.",
  linear:
    "Una clave de API personal, de los ajustes de Linear: Settings → Account → Security & access. Read basta para sincronizar; tu agente necesita Write para cambiar incidencias.",
  wordpress:
    "La dirección del sitio, tu nombre de usuario y una contraseña de aplicación: en WordPress, Usuarios → Perfil → Contraseñas de aplicación. WordPress 5.7 o posterior, por https.",
  pbx: "La ruta de Master.csv, o la dirección de la base de datos CDR y la contraseña de un usuario de solo lectura.",
}

export const RU_SIGNIN = { gives: RU_GIVES, asks: RU_ASKS }
export const ES_SIGNIN = { gives: ES_GIVES, asks: ES_ASKS }
