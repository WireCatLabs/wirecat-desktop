import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

const en = {
  title: "WireCat's own Tailscale connection",
  intro:
    "Tailscale is not installed on this computer. WireCat can join your Tailscale network by itself, as one more device, with no Tailscale app and no administrator password.",
  privacy:
    "WireCat turns off Tailscale's logs and support data for it. Tailscale still sees the device in your network and the time and size of each connection. It cannot read what is sent.",
  offer: "Or let WireCat connect to Tailscale by itself, with no password",
  useApp: "Install the Tailscale app instead",
  steps: { install: "Install it", signin: "Connect to Tailscale" },
  install: "Install",
  installing: "Installing…",
  installFailed: "It did not install.",
  connect: "Connect to Tailscale",
  connecting: "Connecting…",
  waiting: {
    starting: "Connecting to Tailscale…",
    "needs-login": "Sign in to Tailscale in the page that opened in your browser. A free account is enough.",
    "needs-approval": "Your Tailscale network's admin approves new devices. Approve this one in the page that opened.",
    "needs-funnel": "Allow Funnel for this device in the page that opened.",
  },
  openAgain: "Open the page again",
  stop: "Stop",
  connected: (host: ReactNode): ReactNode => <>Connected to Tailscale as {host}.</>,
  next: (bin: string) =>
    `Next, WireCat adds ${bin}'s paths to its Tailscale connection and starts ${bin}'s server in the background. The first call can take a minute while Tailscale makes the HTTPS certificate.`,
  startStep: (bin: string) => `Add ${bin}'s address to WireCat's Tailscale connection`,
  off: (app: string) =>
    `WireCat's Tailscale connection is off, so ${app} cannot reach this server. Turn it on again; the address stays the same.`,
  turnOn: "Turn it on",
  turningOn: "Turning it on…",
}

const ru: typeof en = {
  title: "Собственное подключение WireCat к Tailscale",
  intro:
    "Tailscale на этом компьютере не установлен. WireCat может сам подключиться к вашей сети Tailscale как ещё одно устройство, без приложения Tailscale и без пароля администратора.",
  privacy:
    "WireCat выключает для него логи и данные для поддержки Tailscale. Tailscale по-прежнему видит это устройство в вашей сети, время и объём каждого соединения. Прочитать, что передаётся, он не может.",
  offer: "Или пусть WireCat подключится к Tailscale сам, без пароля",
  useApp: "Лучше установить приложение Tailscale",
  steps: { install: "Установить", signin: "Подключиться к Tailscale" },
  install: "Установить",
  installing: "Устанавливается…",
  installFailed: "Не установилось.",
  connect: "Подключиться к Tailscale",
  connecting: "Подключается…",
  waiting: {
    starting: "Подключается к Tailscale…",
    "needs-login": "Войдите в Tailscale на странице, которая открылась в браузере. Бесплатного аккаунта достаточно.",
    "needs-approval":
      "В вашей сети Tailscale новые устройства одобряет администратор. Одобрите это на открывшейся странице.",
    "needs-funnel": "Разрешите Funnel для этого устройства на открывшейся странице.",
  },
  openAgain: "Открыть страницу ещё раз",
  stop: "Остановить",
  connected: (host) => <>Подключено к Tailscale как {host}.</>,
  next: (bin) =>
    `Дальше WireCat добавит пути ${bin} в своё подключение к Tailscale и запустит сервер ${bin} в фоне. Первый запрос может занять минуту, пока Tailscale выпускает HTTPS-сертификат.`,
  startStep: (bin) => `Добавить адрес ${bin} в подключение WireCat к Tailscale`,
  off: (app) =>
    `Подключение WireCat к Tailscale выключено, поэтому ${app} не достаёт до этого сервера. Включите его снова, адрес останется тем же.`,
  turnOn: "Включить",
  turningOn: "Включается…",
}

const es: typeof en = {
  title: "La conexión propia de WireCat a Tailscale",
  intro:
    "Tailscale no está instalado en este ordenador. WireCat puede unirse a tu red de Tailscale por sí mismo, como un dispositivo más, sin la aplicación de Tailscale y sin contraseña de administrador.",
  privacy:
    "WireCat desactiva para ella los logs y los datos de soporte de Tailscale. Tailscale sigue viendo el dispositivo en tu red y la hora y el tamaño de cada conexión. No puede leer lo que se envía.",
  offer: "O deja que WireCat se conecte a Tailscale por sí mismo, sin contraseña",
  useApp: "Instalar la aplicación de Tailscale",
  steps: { install: "Instalarla", signin: "Conectar con Tailscale" },
  install: "Instalar",
  installing: "Instalando…",
  installFailed: "No se instaló.",
  connect: "Conectar con Tailscale",
  connecting: "Conectando…",
  waiting: {
    starting: "Conectando con Tailscale…",
    "needs-login":
      "Inicia sesión en Tailscale en la página que se abrió en el navegador. Basta con una cuenta gratuita.",
    "needs-approval":
      "En tu red de Tailscale el administrador aprueba los dispositivos nuevos. Aprueba este en la página que se abrió.",
    "needs-funnel": "Permite Funnel para este dispositivo en la página que se abrió.",
  },
  openAgain: "Abrir la página otra vez",
  stop: "Detener",
  connected: (host) => <>Conectado a Tailscale como {host}.</>,
  next: (bin) =>
    `Después, WireCat añade las rutas de ${bin} a su conexión de Tailscale e inicia el servidor de ${bin} en segundo plano. La primera llamada puede tardar un minuto mientras Tailscale crea el certificado HTTPS.`,
  startStep: (bin) => `Añadir la dirección de ${bin} a la conexión de WireCat a Tailscale`,
  off: (app) =>
    `La conexión de WireCat a Tailscale está apagada, así que ${app} no llega a este servidor. Enciéndela otra vez; la dirección sigue siendo la misma.`,
  turnOn: "Encenderla",
  turningOn: "Encendiendo…",
}

export const helperMessages: Messages<typeof en> = { en, ru, es }
