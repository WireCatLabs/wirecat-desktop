# 2026-11-09 — Digests: What to collect (brief) and How it looks (templates) editors

Агент: `digest-editors` · ветка: `feat/digest-editors` · начато: `≈11:00` Europe/Madrid

---

## 1. Задачи

**TASK-150 · Редакторы сводки на экране Digests (план max-cli `2026-11-07-digest-format.md` §9, §10.3–10.4, §11)**
Статус: сделано в ветке.
- «What to collect»: `memo digest brief show --json`, `edit --file -` (текст на stdin), `edit --undo`, `reset`.
  Счётчик «N / 4000» считает как memo (после trim). Отказы memo (`brief.too-long`, `brief.owner-only`) показываются
  его словами. У memo 0.131.68 команды нет (`unknown command 'brief'`) — карточка просит обновить Memo.
- «How it looks»: `memo templates show|edit|preview|reset report/morning-digest --channel --locale`, каналы
  telegram/email/text, языки ru/en. Preview рендерит несохранённый черновик (stdin), результат показан как текст,
  не как HTML.
- Desktop запускает memo без переменных агента (`run::command` их снимает), поэтому memo видит владельца.

## 2. Вопросы Славы

нет

## 3. Находки

**FIND-266 · `memo templates edit/preview --file` не принимает `-`.** `templates-command.ts` в cli-core читает
`readFileSync(given.file)`, без stdin (в отличие от `digest brief edit --file -`). Desktop передаёт `/dev/stdin`
(проверено на `templates preview` с memo 0.131.68). На Windows такого пути нет: сохранение там говорит
воспользоваться терминалом. Исправление — `-` в cli-core, тогда Desktop переходит на него.

**RISK-124 · Диск `/home` был заполнен (191 МБ свободно) во время сборки Rust.** Сборка перенесена в scratchpad
агента; worktree записан в `/home/leemour/Projects/AI/CLEANUP.md`.

## 4. Вопросы к Славе

нет
