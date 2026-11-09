import type { TemplateChannel, TemplateLocale } from "@/domain/digest-editors"
import type { Brief, DigestTemplate } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

type EditorsPart =
  | "digestBrief"
  | "digestBriefSave"
  | "digestBriefUndo"
  | "digestBriefReset"
  | "digestTemplate"
  | "digestTemplateSave"
  | "digestTemplateUndo"
  | "digestTemplateReset"
  | "digestTemplatePreview"

const LIMIT = 4000

const SHIPPED: Record<TemplateChannel, string> = {
  telegram:
    "☀️ <b>Digest for {{ date.date }}</b>\n{{ summary }}\n{% for section in sections %}\n<b>{{ section.kind }}</b>\n{% endfor %}",
  email:
    '<div style="font-family: sans-serif">\n  <p><b>Digest for {{ date.date }}</b></p>\n  <p>{{ summary }}</p>\n</div>',
  text: "{{ emoji }} Digest for {{ date.date }}\n{{ summary }}\n{% for section in sections %}\n{{ section.kind }}\n{% endfor %}",
}

/** The rendered sample, as memo's preview would give it for a synthetic report. */
const rendered = (body: string) =>
  body
    .replaceAll("{{ date.date }}", "November 9")
    .replaceAll("{{ emoji }}", "☀️")
    .replaceAll("{{ summary }}", "Three replies wait for you, one payment is overdue.")
    .replace(/{%[^%]*%}\n?/g, "")
    .replaceAll("{{ section.kind }}", "Today")

/**
 * memo's `digest brief` and `templates` for the browser build. `?digest-brief=old` and `?digest-templates=old` are a memo
 * without the command; `?digest-brief=set` starts with a brief; `?digest-templates-fail=1` refuses every save the way
 * memo's check does.
 */
export function digestEditorsMock(params: URLSearchParams): Pick<Platform, EditorsPart> {
  const briefOld = params.get("digest-brief") === "old"
  const templatesOld = params.get("digest-templates") === "old"
  let brief: string | null =
    params.get("digest-brief") === "set" ? "Projects HRB and the Khimki warehouse first. Skip newsletters." : null
  const briefHistory: (string | null)[] = []
  const stored = new Map<string, string>()
  const history = new Map<string, (string | undefined)[]>()
  const at = (channel: TemplateChannel, locale: TemplateLocale) => `${channel}/${locale}`

  const briefNow = (): Brief =>
    briefOld
      ? { state: "unsupported" }
      : {
          state: "ready",
          body: brief,
          chars: brief?.length ?? 0,
          limit: LIMIT,
          updatedAt: brief ? new Date().toISOString() : null,
          updatedBy: brief ? "memo" : null,
          history: briefHistory.length,
        }
  const templateNow = (channel: TemplateChannel, locale: TemplateLocale): DigestTemplate => {
    if (templatesOld) return { state: "unsupported" }
    const own = stored.get(at(channel, locale))
    return {
      state: "ready",
      body: own ?? SHIPPED[channel],
      stored: own !== undefined,
      updatedAt: own === undefined ? null : new Date().toISOString(),
      updatedBy: own === undefined ? null : "memo",
      history: history.get(at(channel, locale))?.length ?? 0,
    }
  }
  const keep = (channel: TemplateChannel, locale: TemplateLocale, next: string | undefined) => {
    const key = at(channel, locale)
    history.set(key, [stored.get(key), ...(history.get(key) ?? [])])
    if (next === undefined) stored.delete(key)
    else stored.set(key, next)
  }

  return {
    async digestBrief() {
      await delay(250)
      return briefNow()
    },
    async digestBriefSave(body) {
      await delay(400)
      const text = body.trim()
      if (!text) throw new Error("the brief is empty; memo digest brief reset removes it")
      if (text.length > LIMIT)
        throw new Error(
          `the brief is ${text.length} characters; the limit is ${LIMIT}, because every morning run reads it and pays for it. Nothing was saved`,
        )
      if (text !== brief) {
        briefHistory.unshift(brief)
        brief = text
      }
      return briefNow()
    },
    async digestBriefUndo() {
      await delay(400)
      if (briefHistory.length === 0) throw new Error("the brief has no earlier body to put back")
      const previous = briefHistory.shift() ?? null
      briefHistory.unshift(brief)
      brief = previous
      return briefNow()
    },
    async digestBriefReset() {
      await delay(400)
      if (brief !== null) briefHistory.unshift(brief)
      brief = null
      return briefNow()
    },
    async digestTemplate(channel, locale) {
      await delay(250)
      return templateNow(channel, locale)
    },
    async digestTemplateSave(channel, locale, body) {
      await delay(500)
      if (params.get("digest-templates-fail"))
        throw new Error('the template was not saved — sample: it does not render: tag "for" not closed, line:3, col:1')
      keep(channel, locale, body)
      return templateNow(channel, locale)
    },
    async digestTemplateUndo(channel, locale) {
      await delay(400)
      const [previous, ...rest] = history.get(at(channel, locale)) ?? []
      if (!history.get(at(channel, locale))?.length)
        throw new Error(`report/morning-digest ${channel} ${locale} has no earlier body to put back`)
      const current = stored.get(at(channel, locale))
      history.set(at(channel, locale), [current, ...rest])
      if (previous === undefined) stored.delete(at(channel, locale))
      else stored.set(at(channel, locale), previous)
      return templateNow(channel, locale)
    },
    async digestTemplateReset(channel, locale) {
      await delay(400)
      if (stored.has(at(channel, locale))) keep(channel, locale, undefined)
      return templateNow(channel, locale)
    },
    async digestTemplatePreview(channel, locale, draft) {
      await delay(400)
      const body = draft ?? stored.get(at(channel, locale)) ?? SHIPPED[channel]
      const broken = (body.match(/{%/g) ?? []).length !== (body.match(/%}/g) ?? []).length
      return {
        text: rendered(broken ? SHIPPED[channel] : body),
        problems: broken ? ["it does not render: a tag is not closed"] : [],
        templateFailed: broken,
        sample: true,
      }
    },
  }
}
