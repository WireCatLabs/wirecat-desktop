import { AlertTriangle } from "lucide-react"
import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import type { EnrichmentKey } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { SecretField } from "@/ui/SecretField"
import { useEnrichmentKey } from "./api"
import { providerKeyMessages } from "./messages-provider-key"

const PROVIDERS: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic" }
export const providerName = (id: string) => PROVIDERS[id] ?? id

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

type Props = {
  toolId: string
  provider: string
  found: EnrichmentKey
  /** Whether this memo stores a key itself (`models keys`); without it only `missing` is shown. */
  keys: boolean
  /** What a missing key means for the caller's setting. */
  missing: string
  onChanged?: (() => void) | undefined
}

function KeyLine({ found, missing }: Pick<Props, "found" | "missing">) {
  const m = useMessages(providerKeyMessages)
  if (found.present)
    return <span className="text-ink-soft">{m.keyFound(m.keySource[found.source ?? ""] ?? found.source ?? "")}</span>
  return (
    <span className="flex items-start gap-2 text-ink">
      <AlertTriangle className="mt-[0.2rem] size-4 shrink-0 text-warn" aria-hidden />
      <span>{missing}</span>
    </span>
  )
}

/**
 * The provider key, through memo's own `models keys`: a masked field and Save while none is found, Remove while memo
 * keeps one. What is typed lives only in this field until Save hands it to Rust; the field and the request state are
 * cleared at once, so a failed save asks for it again. A memo without `models keys` gets the caller's words only.
 */
export function ProviderKey({ toolId, provider, found, keys, missing, onChanged }: Props) {
  const m = useMessages(providerKeyMessages)
  const change = useEnrichmentKey(toolId)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const fieldId = useId()
  const helpId = useId()

  const run = async (request: Parameters<typeof change.mutateAsync>[0], fail: (message: string) => string) => {
    setError(null)
    try {
      await change.mutateAsync(request)
      setRemoved(!("key" in request))
      onChanged?.()
    } catch (e) {
      setError(fail(messageOf(e)))
    } finally {
      change.reset()
    }
  }

  const failure = (
    <Collapse open={error !== null}>
      <ErrorNotice inline>{error}</ErrorNotice>
    </Collapse>
  )

  if (found.present)
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <KeyLine found={found} missing={missing} />
          {keys && found.source !== "env" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={change.isPending}
              onClick={() => run({ provider, remove: true }, m.keyRemoveFailed)}
            >
              {change.isPending ? m.keyRemoving : m.keyRemove}
            </Button>
          )}
        </div>
        {keys && found.source === "env" && found.envVar && (
          <p className="text-[0.85rem] text-ink-dim">{m.keyEnvStays(found.envVar)}</p>
        )}
        {failure}
      </div>
    )
  if (!keys) return <KeyLine found={found} missing={missing} />
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        const key = draft
        setDraft("")
        run({ provider, key }, m.keySaveFailed)
      }}
    >
      <KeyLine found={found} missing={missing} />
      {removed && <p className="text-[0.875rem] text-ink-soft">{m.keyRemoved}</p>}
      <label htmlFor={fieldId} className="mt-1 text-[0.9rem] font-medium text-ink">
        {m.keyLabel(providerName(provider))}
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 basis-[18rem]">
          <SecretField
            id={fieldId}
            value={draft}
            onChange={setDraft}
            showLabel={m.keyShow}
            hideLabel={m.keyHide}
            disabled={change.isPending}
            describedBy={helpId}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!draft.trim() || change.isPending}>
          {change.isPending ? m.keySaving : m.keySave}
        </Button>
      </div>
      <p id={helpId} className="text-[0.8rem] text-ink-dim">
        {m.keyWhere}
      </p>
      {failure}
    </form>
  )
}
