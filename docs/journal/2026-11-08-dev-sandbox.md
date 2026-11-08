# 2026-11-08 — песочница для Desktop, ссылки, терминал, пустые настройки

Агент: `sandbox` · ветка: `feat/dev-sandbox` · начато: `13:10` Europe/Madrid

---

## 1. Задачи

**TASK-139 · `bin/sandbox <name> [--reset] [--seed fresh|tools|demo] [--from-store <path>]`**
Статус: сделано. `bin/try-fresh-install` теперь `bin/sandbox fresh`. `--exec` запускает команду внутри.
`bin/sandbox-check` проверяет изоляцию (пути doctor, npm prefix, store, keyring, отпечаток своих файлов, `--app`).
Гайд `docs/dev/guides/sandbox.md`. Сообщения в demo не засеять: ни один инструмент не берёт сообщения из файла.

**TASK-140 · ссылки не открываются в песочнице, и приложение молчит**
Статус: сделано. Обёртка `xdg-open` в песочнице; диалог «The link did not open» с адресом для всех `platform.openUrl`
(`src/platform/bridge.ts` `withOpenFailure`, `src/app/LinkFailure.tsx`), мок `?open=fail`.

**TASK-141 · Settings без инструментов**
Статус: сделано. Пустое состояние с кнопкой Open Tools, подсказка «Not installed». WireCat (shared) читается через
`config show` tg, max или wa, без них не работает (так и было, подсказка `sharedNeedsTool`).

**TASK-142 · терминал и шелл**
Статус: сделано. `xdg-terminal-exec` вторым после `$TERMINAL`; шелл учётки по uid (`getent passwd <uid>`), не по
`$USER`. В песочнице `$TERMINAL` = обёртка: окно его Ptyxis, команда внутри с окружением песочницы.

## 2. Вопросы Славы

## 3. Находки

**BUG-95 · ссылки в песочнице уходили в Brave, который падал**
Под `env -i` нет `XDG_DATA_DIRS`, а desktop-файл Firefox (snap, его браузер по умолчанию) лежит в
`/var/lib/snapd/desktop`. xdg-open выбрал Brave; тот стартовал в пустом доме без D-Bus и упал: дампы в
`~/.cache/wirecat-fresh-install/home/.config/BraveSoftware/Brave-Browser/Crash Reports/completed/`. xdg-open вернул 0,
так что ошибки не было. Новый диалог такой случай не ловит: crate `open` считает успехом запущенный обработчик.

**BUG-96 · ошибка `openUrl` нигде не показывалась**
Все вызовы `platform.openUrl` без catch, отказ пропадал. Теперь один перехват в `bridge.ts`.

**FIND-250 · терминал и шелл в песочнице были его, но без его настроек**
`$0` был zsh (шелл из passwd), `$SHELL=/bin/bash` пришёл из `SHELL=/bin/bash` скрипта. Терминал — Ptyxis, он и есть по
умолчанию (`xdg-terminal-exec --print-id` → `org.gnome.Ptyxis.desktop`), но без D-Bus и с пустым домом он не видит
своего профиля dconf. zsh читал `.zshrc` песочницы, поэтому голый промпт.

**FIND-251 · Drive не создаёт профиль без входа**
`drive personal config set` отвечает `profile.unknown`, профиль появляется только после `session start`.

## 4. Вопросы к Славе

**NEED-2290 · Должен ли шелл в терминале песочницы читать твой настоящий `~/.zshrc`?**
- Сейчас: читает `.zshrc` песочницы (только строки PATH от WireCat), промпт голый.
- Варианты: **A** оставить так · **B** флаг `--my-shell`, который подставляет твой `ZDOTDIR`
- Я бы: **A** — твой `.zshrc` вернёт nvm и `~/.local/bin` в PATH, и инструменты в окне пойдут к твоим настоящим данным.
- Если не ответишь: остаётся A.
