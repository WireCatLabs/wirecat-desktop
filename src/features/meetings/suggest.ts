import {
  type DateMeaning,
  type QueryOptions,
  quoteValue,
  type SearchFieldInfo,
  type SuggestWords,
  suggestSearch,
  type ValueOption,
} from "@/domain/search"
import type { MeetingRow } from "@/platform/bindings"
import { MEETING_KINDS, type meetingMessages } from "./messages"

type M = (typeof meetingMessages)["en"]

/** The fields memo's `meetings list` takes (cli-core `MEETINGS_LIST_QUERY`), less the window the page sets itself. */
const FIELDS: SearchFieldInfo[] = [
  { name: "text", group: "what", example: "text:standup", top: true },
  { name: "person", group: "who", example: 'person:"person:12"', top: true },
  { name: "kind", group: "what", example: "kind:call", top: true },
  { name: "source", group: "where", example: "source:zoom:ana@example.org", top: true },
  { name: "has_transcript", group: "what", example: "has_transcript:true", top: true },
]

const counted = (values: Iterable<[string, string | null]>): ValueOption[] => {
  const all = new Map<string, ValueOption>()
  for (const [value, label] of values) {
    const seen = all.get(value)
    if (seen) seen.count = (seen.count ?? 0) + 1
    else all.set(value, { value, label, count: 1 })
  }
  return [...all.values()]
}

/** Every value the field can take here: titles and people from the meetings read, and the accounts memo holds. */
export function meetingValues(rows: readonly MeetingRow[], accounts: readonly string[], m: M) {
  return {
    text: counted(rows.flatMap((r) => (r.title ? [[r.title, null] as [string, null]] : []))),
    person: counted(
      rows.flatMap((r) =>
        r.participants.flatMap((p) => (p.person ? [[p.person.ref, p.person.name ?? p.name] as [string, string]] : [])),
      ),
    ),
    kind: MEETING_KINDS.map((k) => ({ value: k, label: m.kinds[k] })),
    source: accounts.map((a) => ({ value: a, label: a.split(/:(.*)/s)[1] || a })),
    has_transcript: [
      { value: "true", label: m.withTranscript },
      { value: "false", label: null },
    ],
  } satisfies Record<string, ValueOption[]>
}

const fold = (s: string) => s.normalize("NFC").toLowerCase().replaceAll("ё", "е")

/**
 * The query bar's rows: Search's own for fields and their values, and for a plain word also the titles holding it,
 * which go in as a phrase memo matches in the title.
 */
export function suggestMeetings(
  query: string,
  cursor: number,
  all: boolean,
  values: ReturnType<typeof meetingValues>,
  m: M,
): QueryOptions {
  const words: SuggestWords = {
    group: m.groups,
    describe: (field) => m.fieldHelp[field] ?? null,
    more: m.moreFields,
    popularHeading: m.popular,
    datesHeading: m.popular,
    valuesHeading: m.valuesOf,
    count: m.times,
  }
  const base = suggestSearch(query, cursor, {
    fields: FIELDS,
    values,
    used: {},
    all,
    now: new Date(),
    words,
    // No `date` field here, so no date row ever needs these words.
    dateWords: {} as Record<DateMeaning, string>,
    what: "meetings",
  })
  const typed = query.slice(base.from, base.to)
  if (typed.length < 2 || /[:"]/.test(typed) || /^[-+]/.test(typed)) return base
  const wanted = fold(typed)
  const titles = values.text
    .filter((t) => fold(t.value).includes(wanted) && fold(t.value) !== wanted)
    .sort((a, b) => Number(!fold(a.value).startsWith(wanted)) - Number(!fold(b.value).startsWith(wanted)))
    .slice(0, 8)
    .map((t) => ({ label: t.value, insert: quoteValue(t.value), note: m.times(t.count ?? 1), group: m.titles }))
  return { ...base, items: [...titles, ...base.items] }
}
