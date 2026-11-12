/** The host of an origin such as `https://openrouter.ai`, for a line that names where something goes. */
export function hostOfOrigin(origin: string | null): string {
  if (!origin) return ""
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

const DEFAULT_HOST: Record<string, string> = { anthropic: "api.anthropic.com", openai: "api.openai.com" }

/** A server on this computer: the pictures sent to it do not leave. */
export const isLocalHost = (host: string) => /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/.test(host)

/** The host the key and the pictures go to, from what is typed or saved, so a line can name it before anything is sent. */
export function providerHost(provider: string, baseUrl: string | null): string {
  if (provider === "ollama") return "localhost"
  const typed = baseUrl?.trim()
  if (provider === "anthropic" || !typed) return DEFAULT_HOST[provider] ?? ""
  try {
    return new URL(typed).host || typed
  } catch {
    return typed
  }
}

/** Whether pictures stay on this computer with this provider and address. */
export const staysHere = (provider: string, baseUrl: string | null) => isLocalHost(providerHost(provider, baseUrl))

/** memo's own rule: a saved model on this computer needs no key. memo's `origin` wins over what the page derives. */
export const modelOnThisComputer = (m: { provider: string | null; baseUrl: string | null; origin: string | null }) =>
  m.provider !== null && (m.origin ? isLocalHost(hostOfOrigin(m.origin)) : staysHere(m.provider, m.baseUrl))
