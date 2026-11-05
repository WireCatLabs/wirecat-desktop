# 2026-11-05 — шаги входа для почты, Календаря, Диска и Zoom

Агент: `signin-steps` · ветка: `feat/signin-steps` · начато: `01:00` Europe/Madrid

---

## 1. Задачи

**TASK-113 · Шаги входа на десктопе «как у tg» для почты (через mail-cli), Google Календаря, Google Диска и Zoom**
Статус: сделано, кроме входа Gmail через приложение WireCat (его нет в mail-cli, см. FIND-202).
Email теперь — отдельный инструмент `mail` (@wirecat/mail-cli), а не часть memo; `memo mail add` больше нигде не
показывается. В плане входа: выбор провайдера (Microsoft / Gmail / другой сервер), адрес, пароль приложения, «Использовать
своё приложение» (файл клиента Google или Application ID Microsoft). gcal добавлен в каталог (без поиска и синхронизации).
Тексты Zoom объясняют, зачем своё приложение и что копировать.

## 2. Вопросы Славы

Нет.

## 3. Находки

**FIND-201 · mail 0.14 не печатает шаги входа для окна**
`mail session start` не знает `--answer-stdin` и не пишет `open_url`/`needs`: без терминала адрес нужен флагом
`--address`, пароль — переменной `MAIL_PASSWORD`. Десктоп передаёт их так (`src-tauri/src/signin.rs`), запускает с
`--quiet` и читает единственную оставшуюся строку `Open Microsoft sign-in: <url>` как ссылку
(`src-tauri/src/signin_steps.rs`). Проверено запуском mail 0.14 во временных папках. Правильное место — cli-core
`signInSteps` в mail-cli; после этого строку можно не разбирать.

**FIND-202 · У mail нет приложения WireCat для Google, у gcal 0.19 из npm — тоже**
mail-cli `src/oauth.ts`: `googleClient` без `--client-file` бросает «Gmail over OAuth needs your own Google app». Поэтому
Gmail по умолчанию входит паролем приложения, а через браузер — только со своим файлом клиента. `gcal p session start`
(0.19.0 из npm) отвечает «no Google OAuth client is set up»; окно ловит это и открывает выбор своего приложения. drive
0.59 открывает Google с приложением WireCat (проверено).

**FIND-203 · Outlook.com требует включить IMAP до входа**
mail-cli `src/providers.ts`, шаги Outlook: Settings → Mail → Forwarding and IMAP → Let devices and apps use IMAP. Это
второй шаг плана Microsoft.

**DEBT-16 · Механизм `partOf` остался без единого примера**
Email был единственной частью чужого пакета. Код `partOf`/`commandPrefix` (catalog, install, logs) оставлен как есть;
тест `src/app/Email.test.tsx` про «Email внутри Memo» удалён вместе с примером. Убрать механизм целиком — отдельное
решение.

## 4. Вопросы к Славе

Нет.
