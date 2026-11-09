import type { AiModel } from "./ai-model-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Settings "AI model" stand-in for memo's `models ai` commands. `?ai=none` (default: nothing set), `?ai=anthropic`,
// `?ai=openrouter`, `?ai=ollama` (set, pictures allowed), `?ai=noimages` (set, pictures not allowed), `?ai=old` (a memo
// before `models ai`), `?ai-check=<reason>` (what Check answers, `ai.ok` by default), `?ai-fail=set` (the save is refused
// because the address is not allowed). A picture added with `?file=image` is read, or not, by this state.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("ai") ?? "none"

const NONE: AiModel = {
  provider: null,
  model: null,
  baseUrl: null,
  origin: null,
  beta: false,
  images: false,
  key: { stored: false, source: null },
}

const SEEDS: Record<string, Partial<AiModel>> = {
  anthropic: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    origin: "https://api.anthropic.com",
    images: true,
    key: { stored: true, source: "keyring" },
  },
  noimages: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    origin: "https://api.anthropic.com",
    key: { stored: true, source: "keyring" },
  },
  openrouter: {
    provider: "openai",
    model: "openai/gpt-4o-mini",
    baseUrl: "https://openrouter.ai/api/v1",
    origin: "https://openrouter.ai",
    images: true,
    key: { stored: true, source: "file" },
  },
  ollama: {
    provider: "ollama",
    model: "llava",
    baseUrl: "http://localhost:11434",
    origin: "http://localhost:11434",
    beta: true,
    images: true,
    key: { stored: false, source: null },
  },
}

let state: AiModel = { ...NONE, ...SEEDS[scenario] }

const DEFAULT_ORIGIN: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  ollama: "http://localhost:11434",
}

/** What memo's `sources add` answers for a picture, from the state Settings left. */
export function imageOutcome(): { read: string; image: { readBy: string | null; reason: string | null } } {
  const reason = !state.provider
    ? "ai.not-set"
    : !state.images
      ? "ai.images-not-allowed"
      : !state.key.stored && state.provider !== "ollama"
        ? "ai.key-missing"
        : null
  return reason
    ? { read: "no-text", image: { readBy: null, reason } }
    : { read: "extracted", image: { readBy: `${state.provider}/${state.model}`, reason: null } }
}

export function aiModelMock(): Pick<Platform, "aiModelShow" | "aiModelSet" | "aiModelOff" | "aiModelCheck"> {
  return {
    async aiModelShow() {
      await delay(300)
      if (scenario === "old") throw new Error("error: unknown command 'ai'")
      return state
    },
    async aiModelSet(choice) {
      await delay(500)
      if (params.get("ai-fail") === "set" || /^http:\/\/(?!localhost|127\.)/.test(choice.baseUrl ?? "")) {
        throw new Error("ai.address-refused")
      }
      const origin = choice.baseUrl ? new URL(choice.baseUrl).origin : (DEFAULT_ORIGIN[choice.provider] ?? null)
      state = {
        provider: choice.provider,
        model: choice.model,
        baseUrl: choice.baseUrl,
        origin,
        beta: choice.provider === "ollama",
        images: choice.images,
        key: choice.key
          ? { stored: true, source: "keyring" }
          : choice.provider === state.provider
            ? state.key
            : { stored: false, source: null },
      }
      return state
    },
    async aiModelOff() {
      await delay(300)
      const changed = state.provider !== null
      state = { ...NONE, key: state.key }
      return { changed, keyKept: true }
    },
    async aiModelCheck() {
      await delay(900)
      const reason = params.get("ai-check") ?? (state.provider ? "ai.ok" : "ai.not-set")
      return {
        ok: reason === "ai.ok",
        reason,
        ms: reason === "ai.ok" ? 840 : null,
        provider: state.provider,
        model: state.model,
        origin: state.origin,
      }
    },
  }
}
