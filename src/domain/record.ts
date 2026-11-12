export function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = record
  return rest
}
