# A new Rust command

A command is the only way the interface asks the computer to do something. Read rules 1, 2, 4, 5 and 6 in
[CLAUDE.md](../../../CLAUDE.md) first.

## Rules

- **Today.** One `#[tauri::command]` in `src-tauri/src/commands/<feature>.rs`, registered in `generate_handler!` in
  [lib.rs](../../../src-tauri/src/lib.rs). It parses arguments and calls a module. The work lives in the module, like
  [commands/digests.rs](../../../src-tauri/src/commands/digests.rs) calls `digest_book.rs`.
- **Today.** The command body is `crate::log::command("<name>", async move { … })`, so each call is a `tracing` span
  with its time and result ([log.rs](../../../src-tauri/src/log.rs); every line is masked).
- **Today.** It takes a tool **id** and validated arguments, never a program or a command line. Resolve the id with
  `catalog::tool(&id)?` and a profile with `catalog::validate_profile`
  ([catalog.rs](../../../src-tauri/src/catalog.rs)).
- **Today.** Start programs only with [run.rs](../../../src-tauri/src/run.rs) (`run::command`, `run_command`,
  `stream`). It sets PATH, timeouts and kills the whole process tree. No `sh -c`. Shell lines exist only in
  `terminal.rs`, as rule 2 says.
- **Today.** Slow work runs in `attempt(...)` or `blocking(...)` from
  [commands/mod.rs](../../../src-tauri/src/commands/mod.rs), so the window does not freeze.
- **Today.** Output that may hold personal data goes through [redact.rs](../../../src-tauri/src/redact.rs) before
  it leaves Rust (rule 4).
- **Today.** Progress uses a `Channel<Event>` argument with an enum serialised with an `event` tag, like `InstallEvent`.
  The interface passes events to the store as they come; only page events are parsed (`pages()` in
  [bridge.ts](../../../src/platform/bridge.ts)).
- **Today.** No `sudo`, no system folders (rule 6). Deleting data only through `storage.rs` paths (rule 5).
- **Today.** Add the schema in `src/platform/<area>-schemas.ts`, the method in
  [types.ts](../../../src/platform/types.ts) and [bridge.ts](../../../src/platform/bridge.ts) (`call(schema, "cmd")`),
  and a mock answer in `src/platform/mock-<area>.ts`.
- **Today.** Errors are `AppError` ([error.rs](../../../src-tauri/src/error.rs), `thiserror`), serialised as
  `{ kind, message }`. The message is a sentence a user can act on. The interface receives a `CommandError`
  ([command-error.ts](../../../src/platform/command-error.ts)) and turns any failure into text with `errorText` from
  [shared/errors.ts](../../../src/shared/errors.ts), never by hand. `known_tool` and `valid_profile` in
  `commands/mod.rs` give the `unknown_tool` and `invalid_profile` kinds.
- **Today.** Versions are compared only by `tools::older` ([tools.rs](../../../src-tauri/src/tools.rs)), and a CLI
  that refuses an unknown command or option is read only by `memo_cli::unknown_to_cli`
  ([memo_cli.rs](../../../src-tauri/src/memo_cli.rs)). The installed version comes from `tools::installed_version`.
  The interface shows "too old" with `ToolNeeded` ([reuse.md](reuse.md)).
- **Today.** A run that writes to stdin uses `run::run_with_input`; a JSON answer's success and reason are read with
  `skills::ok` and `skills::reason` (it looks in `error.reason`, then `error.details.reason`).
- **Today.** A Rust type the interface reads is registered in [bindings.rs](../../../src-tauri/src/bindings.rs), and
  `cargo test bindings` writes [platform/bindings.ts](../../../src/platform/bindings.ts). Older answers still have a
  hand schema in `src/platform/<area>-schemas.ts`; a new type uses the bindings.
- **Today.** A test that reads the owner's real store or accounts, or changes this computer, is `#[ignore]` and
  returns at once unless `WIRECAT_PROBES` names what it may touch ([probe.rs](../../../src-tauri/src/probe.rs);
  [testing.md](testing.md#probes)).

## Checklist

1. Unit tests in the module (`#[cfg(test)]`): argument validation, the argv built, parsing of the tool's output.
   Do not run real tools in unit tests.
2. A schema test when the answer shape is not trivial, like
   [search-schemas.test.ts](../../../src/platform/search-schemas.test.ts).
3. The mock answers the same shape, so `pnpm dev` and the component tests use it.
4. A line in [ARCHITECTURE.md](../ARCHITECTURE.md) for a new module.
5. `pnpm rust:fmt`, `pnpm rust:lint`, `pnpm rust:test` (in `pnpm check`).
