# 2026-11-23 — аудит установки и входа в инструменты

Агент: `install-audit` · ветка: `fix/install-audit` · начато: `13:40` Europe/Madrid

---

## 1. Задачи

**TASK-160 · Аудит: как Desktop узнаёт об инструментах, ставит их и входит в них; починить сломанное и жёсткий код**
Статус: частично. Аудит ниже. Починено: вход в Notion (BUG-732), вход нового CLI из шаблона по его описанию
(cli-template, FIND-281). Переход встроенных инструментов на описание CLI или реестр ждёт решения (NEED-2603).

## 2. Вопросы Славы

Нет.

## 3. Находки

**FIND-278 · Встроенные инструменты — это `catalog/tools.json`, вкомпилированный в приложение.**
`src-tauri/src/catalog.rs:4` (`include_str!`) и `src/domain/catalog.ts:2` (`import raw`). Пакет, бинарник, слова
`doctor`/`setup`/`sync`, папки данных, способы входа, порт MCP — всё оттуда; установка идёт по `package` через npm с
проверкой provenance (`src-tauri/src/install.rs`). `--wcat-describe` встроенные инструменты не читают вовсе: им
пользуются только свои инструменты (`src-tauri/src/own_tools.rs`, манифест `contracts/wirecat.json` из tarball npm)
и подписанный реестр сообществ (`src-tauri/src/registry.rs:14`, `https://wirecat.dev/registry/v1/desktop-tools.json`,
только `"community": true`, выключен по умолчанию). Новый официальный CLI без релиза Desktop появляется только как
«свой инструмент» по имени `@wirecat/…` (`src-tauri/src/community.rs:308`), без перевода и без логотипа.

**FIND-279 · Что зашито по инструментам в коде Desktop (кроме каталога).**
- Логотипы: `src/shared/ToolIcon.tsx:22` (`LOGOS`), `:38` (`icons`), `:59` (tg). Без записи — общий значок пакета.
- Переводы RU/ES: слоган и описание `src/features/tools/messages-tool-text.ts`, «даёт»/«попросит»
  `src/features/tools/messages-signin-text.ts` (перенесён из onboarding в этой ветке), шаги входа
  `src/features/signin/messages-plan.ts`, «Что понадобится» `src/features/signin/messages-wizard.ts:42`,
  местные имена `messages-tool-text.ts:6` (`Яндекс Диск`). Без записи — английский текст из каталога.
- Особые ветки входа: `src/features/signin/Plan.tsx:55` (Bitrix24 — свои шаги), `:56` (Asterisk), `:45` (Gmail),
  `src/shared/signin-store.ts:204`, `src/features/signin/BotSteps.tsx` (боты tg/max/wa), zm `appSetup`.
- Прочее: `src/features/onboarding/InstallWait.tsx:42` (подсказки во время установки для tg/wa/zm/drive/memo),
  `src/features/tools/messages-drive.ts:419` (notion/ydisk в выборе папок), `src/features/tools/removal-words.ts:16`.
- `if tool === "wordpress"` нет: вход WordPress идёт из `signIn.methods[].site/login` каталога.
- Остальные ~360 упоминаний id (`tg`, `memo`, `email`…) — функции продукта (сводки, аналитика, рецепты), не установка.

Что могло бы прийти из описания CLI: `tagline`, `summary`, `signIn.gives/asks/methods`, `setup`, `doctor`, `sync`,
`accountRemove`, `mcpServer` без порта — это уже есть в манифесте (cli-base `docs/REFERENCE.md:432`). Нет в манифесте:
переводы, логотип, `search.fields`, `crm`, `meetings`, `folderPicker`, порт MCP, `sync.what` как перечисление
(в манифесте это свободный текст). Это может держать реестр (cli-docs) или Desktop.

**FIND-280 · Новые инструменты есть в Desktop и ставятся.**
attio, hubspot, wordpress, linear, notion, amo, ydisk, pbx (asterisk) — все в каталоге, у всех логотип или значок,
слоган, описание, «даёт»/«попросит» на трёх языках (снимок `?onboarding=off --lang es`). Вход:
attio, linear, ydisk, wordpress — свои шаги в окне; amo, hubspot, pbx — поток `setup show` (`setupFrom`);
WordPress просит адрес сайта, логин и пароль приложения (#459). Notion — см. BUG-732.

**BUG-732 · Вход в Notion: «Что понадобится» по-английски в RU/ES и без шагов.**
`Plan.tsx` для инструмента без плана брал `entry.signIn.asks` из каталога, то есть английский, хотя перевод был в
onboarding. У Notion не было шагов, ссылки и времени, а текст каталога вёл на устаревший `notion.so/profile/integrations`.
Исправлено в этой ветке: перевод берётся через `toolText`, у Notion шаги на трёх языках по странице Notion о личных
токенах (developers.notion.com, `New token`, `Create token`, срок до года), текст каталога как в манифесте notion-cli.

**FIND-281 · Описания (`--wcat-describe`) шести выпущенных CLI не говорят, как входить в окне.**
По npm latest (2026-11-23): `signIn.methods` есть только у attio 0.2.2 и wordpress 0.3.0. Нет у notion 0.7.0,
yandex-disk 0.4.0, linear 0.2.0, hubspot 0.5.0, amo 0.3.0, asterisk 0.9.0. У hubspot/amo/asterisk нет и
`setupFrom`: их cli-base 0.125–0.127 старше 0.128.0, где он появился. Встроенным это не мешает (есть каталог), но
новый CLI из шаблона тоже выходил без `methods`. Шаблон починен (cli-template, отдельный PR).

**FIND-282 · Тексты каталога и описания CLI расходятся.**
Слоганы, `sync.what`, `gives/asks` у notion/ydisk/amo/attio отличаются; у notion и ydisk в манифесте `search: null`, а в
каталоге поиск есть; `accountRemove.minVersion` у notion/pbx `null` против `0.0.0`. Сверки нет: каталог правят руками.

**DEBT-65 · Переводы инструментов живут только в Desktop.**
Новый CLI без правки Desktop показывается по-английски в RU/ES. В манифесте нет места для переводов.

**DEBT-66 · Проверка `pnpm docs:spell` падает локально на `docs/releases/0.7.5.md:13` («Attio»), в CI нет.**
Не трогал.

**IDEA-39 · Встроенный список из реестра, собранного из манифестов.**
cli-docs уже собирает и подписывает список. Если он будет включать официальные CLI (запись = манифест + то, чего в
манифесте нет), Desktop сможет показывать новый официальный инструмент без своего релиза. См. NEED-2603.

## 4. Вопросы к Славе

**NEED-2603 · Откуда Desktop берёт официальные инструменты: из вкомпилированного каталога или из подписанного реестра?**
- Сейчас: новый официальный CLI требует записи в `catalog/tools.json`, логотипа, переводов и релиза Desktop.
  Без этого он доступен только как «свой инструмент» по имени npm, по-английски и с общим значком.
- Варианты: **A** оставить каталог, добавить проверку расхождений с манифестами · **B** официальные записи в реестре
  cli-docs, собранные из манифестов, с переводами и значком (SVG-путь) там же; каталог — запасной список для офлайна ·
  **C** переводы в манифест CLI (cli-base), остальное как сейчас.
- Я бы: **B** — это и есть «установка из конфигурации», а подпись и проверка записей уже работают для сообществ.
- Если не ответишь: каждый новый CLI ждёт релиза Desktop, а тексты каталога и CLI продолжают расходиться.
