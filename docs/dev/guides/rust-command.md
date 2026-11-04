# A new Rust command

A command is the only way the interface asks the computer to do something. Read rules 1, 2, 4, 5 and 6 in
[CLAUDE.md](../../../CLAUDE.md) first.

## Rules

- **Today.** One `#[tauri::command]` in [lib.rs](../../../src-tauri/src/lib.rs), registered in
  `generate_handler!`. It parses arguments and calls a module. The work lives in the module, like
  `install_tool` calls [install.rs](../../../src-tauri/src/install.rs).
- **Today.** It takes a tool **id** and validated arguments, never a program or a command line. Resolve the id with
  `catalog::tool(&id)?` and a profile with `catalog::validate_profile`
  ([catalog.rs](../../../src-tauri/src/catalog.rs)).
- **Today.** Start programs only with [run.rs](../../../src-tauri/src/run.rs) (`run::command`, `run_command`,
  `stream`). It sets PATH, timeouts and kills the whole process tree. No `sh -c`. Shell lines exist only in
  `terminal.rs`, as rule 2 says.
- **Today.** Slow work runs in `blocking(...)` so the window does not freeze.
- **Today.** Output that may hold personal data goes through [redact.rs](../../../src-tauri/src/redact.rs) before
  it leaves Rust (rule 4).
- **Today.** Progress uses a `Channel<Event>` argument with an enum serialised with an `event` tag, like `InstallEvent`.
  The interface parses each event with a schema.
- **Today.** No `sudo`, no system folders (rule 6). Deleting data only through `storage.rs` paths (rule 5).
- **Today.** Add the schema in `src/platform/<area>-schemas.ts`, the method in
  [types.ts](../../../src/platform/types.ts) and [bridge.ts](../../../src/platform/bridge.ts) (`call(schema, "cmd")`),
  and a mock answer in `src/platform/mock-<area>.ts`.
- **Today.** Errors are `Result<_, String>` with a sentence a user can act on.
- **Target.** Errors are a `thiserror` enum serialised as `{ kind, message }`. The interface chooses words by
  `kind`.
- **Target.** Types and bindings are generated (`tauri-specta`). No hand-written schema for a Rust struct.
- **Target.** Commands live in `src-tauri/src/commands/<feature>.rs`, and each logs with `tracing`.

## Checklist

1. Unit tests in the module (`#[cfg(test)]`): argument validation, the argv built, parsing of the tool's output.
   Do not run real tools in unit tests.
2. A schema test when the answer shape is not trivial, like
   [search-schemas.test.ts](../../../src/platform/search-schemas.test.ts).
3. The mock answers the same shape, so `pnpm dev` and the component tests use it.
4. A line in [ARCHITECTURE.md](../ARCHITECTURE.md) for a new module.
5. `pnpm rust:fmt`, `pnpm rust:lint`, `pnpm rust:test` (in `pnpm check`).
