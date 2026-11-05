/** A failed Rust command arrives as `{ kind, message }`. Callers read `.message` or `String(e)`, so both give the
 * message the command wrote; `kind` is there for words chosen by kind. */
export class CommandError extends Error {
  readonly kind: string

  constructor(kind: string, message: string) {
    super(message)
    this.name = "CommandError"
    this.kind = kind
  }

  override toString(): string {
    return this.message
  }
}

export function commandError(e: unknown): unknown {
  if (typeof e !== "object" || e === null) return e
  const { kind, message } = e as { kind?: unknown; message?: unknown }
  return typeof kind === "string" && typeof message === "string" ? new CommandError(kind, message) : e
}
