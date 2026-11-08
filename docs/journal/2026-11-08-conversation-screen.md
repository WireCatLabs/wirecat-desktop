# 2026-11-08 — экран переписки для ссылок chat/… и msg/…

Агент: subagent · ветка: `feat/conversation-screen` · начато: 19:30 Europe/Madrid

---

## 1. Задачи

**TASK-144 · Экран переписки только для чтения: `chat/…` и `msg/…` открываются в приложении**
Решение владельца: «A — простой экран: переписка с выделенным сообщением, только чтение». План:
`max-cli/docs_ai/plans/2026-11-07-deep-links.md` (URL grammar v1, Desktop handling, Security). Сделано:
`src-tauri/src/conversation.rs`, `src/features/conversation/`, mock `?link=/v1/msg/telegram/1/2/30`. PR открыт, не смержен.

## 2. Вопросы Славы

Нет.

## 3. Находки

**FIND-257 · У memo нет команды «сообщения чата, начиная с последнего»**
`memo messages show <msg> --before-n/--after-n` читает соседей сообщения (проверено на живом store, только счётчики),
но по `chat:`-ссылке отвечает `validation_error` («is not a message locator»). Поэтому `chat/…` мессенджера
читается через `tg|max|wa <profile> messages list <chat ref> --offline`, профиль берётся из ответа `memo show`.
`memo show chat:…` для почты не называет команду (`open.argv: null`, «no CLI has registered email»).

**RISK-119 · Цепочка писем открывается от первого письма; это верно для Gmail, для другой почты — вывод**
В Gmail id цепочки равен id первого письма (97 из 100 найденных писем на этой машине имели id цепочки = id письма,
и цепочка из 5 писем открылась от первого). Для IMAP-ящика не Gmail это не проверено: там экран скажет «WireCat
пока не может показать эту цепочку» (состояние `thread`), а ссылка `msg/…` на любое письмо цепочки работает.

**IDEA-34 · `memo messages list <chat:…> [--before <msg>] --limit N` в cli-core**
Одна команда memo дала бы чат и цепочку писем с конца и с листанием назад, и Desktop не ходил бы в мессенджер.
По правилу 1 (CLAUDE.md) недостающее добавляют в CLI.

**FIND-258 · https-адрес внутри «HTML» в тексте становится кнопкой**
Текст `<img src="https://tracker.example/pixel.png">` показывается как текст; картинка не грузится, но сам адрес —
кнопка, которая открывает браузер только по клику (`linkParts`, тот же разбор, что в шагах входа почты). `javascript:`,
`file:`, `http:` остаются текстом. Права opener — только `https://*` (`src-tauri/capabilities/default.json`).

**RISK-120 · Диск /home заполнен на 98% (8–9 ГБ свободно)**
Новый `target/` для worktree занял бы ~4.6 ГБ, поэтому cargo собирался в `wirecat-desktop/src-tauri/target`
основного checkout (`CARGO_TARGET_DIR`). Следующая сборка в основном checkout пересоберёт только сам крейт.

**DEBT-35 · «memo слишком старый» определяется по тексту ошибки**
`conversation.rs` считает `unknown command` / `unknown option` признаком старого memo; минимальной версии в
каталоге для этого экрана нет. С какой версии у memo есть `show` и `messages show --before-n` — не проверено.

## 4. Вопросы к Славе

Нет.
