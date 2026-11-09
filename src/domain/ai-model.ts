/** The host of an origin such as `https://openrouter.ai`, for a line that names where something goes. */
export function hostOfOrigin(origin: string | null): string {
  if (!origin) return ""
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}
