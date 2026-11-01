/** One line of what surrounds a hit: a message of its chat or thread, or a line of a meeting's transcript. */
export type ContextLine = {
  key: string
  when: string | null
  /** Into the meeting, for a transcript line. */
  at: number | null
  who: string | null
  fromMe: boolean
  text: string | null
  files: string[]
  /** The hit itself, or the transcript line it was found in. */
  anchor: boolean
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const list = (v: unknown) => (Array.isArray(v) ? v : [])

// `messages context` marks the asked message `anchor: true`; memo's `messages show` does not, so its ref decides.
function messageLines(body: Record<string, unknown>, ref: string | null): ContextLine[] {
  return list(body.items).map((raw, i) => {
    const m = obj(raw)
    return {
      key: str(m.ref) ?? `#${i}`,
      when: str(m.timestamp),
      at: null,
      who: str(m.sender_name) ?? str(obj(obj(m.email).from).name),
      fromMe: m.sender_is_me === true,
      text: str(m.text) ?? str(m.transcript) ?? str(obj(m.email).subject),
      files: list(m.attachments).flatMap((a) => {
        const f = obj(a)
        const name = str(f.name) ?? str(f.title) ?? str(f.kind)
        return name ? [name] : []
      }),
      anchor: m.anchor === true || (ref !== null && m.ref === ref),
    }
  })
}

// `meetings transcript` answers each current transcript of the meeting; the first one's lines are read.
function transcriptLines(body: Record<string, unknown>, offset: number | null): ContextLine[] {
  const transcript = obj(list(body.items)[0] ?? body.item)
  const lines = list(transcript.lines).map((raw, i) => {
    const l = obj(raw)
    return {
      key: String(num(l.position) ?? i),
      when: null,
      at: num(l.offset_ms),
      who: str(l.speaker),
      fromMe: false,
      text: str(l.text),
      files: [],
      anchor: false,
    }
  })
  if (offset === null) return lines
  let best = -1
  lines.forEach((l, i) => {
    if (l.at !== null && l.at <= offset) best = i
  })
  return lines.map((l, i) => (i === best ? { ...l, anchor: true } : l))
}

export function contextLines(what: string, body: unknown, hit: Record<string, unknown>): ContextLine[] {
  const b = obj(body)
  return what === "meetings" ? transcriptLines(b, num(hit.offset_ms)) : messageLines(b, str(hit.ref))
}

/** A link the page may open for a hit: only https, never a file or custom scheme. */
export function hitLink(hit: Record<string, unknown>): string | null {
  const url = str(hit.url)
  return url?.startsWith("https://") ? url : null
}
