import type { Listed, Match, PersonDetail } from "@/platform/people-schemas"
import type { PersonProfile } from "@/platform/person-profile-schemas"

export type Contacts = { phones: string[]; emails: string[] }

/** The last ten digits: `+7 912…` and `8 912…` are one number. */
const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10)
const emailKey = (email: string) => email.trim().toLowerCase()
export const keyOf = (signal: string | null) => (signal === "phone" ? phoneKey : emailKey)
const looksLikePhone = (v: string) => /^\+?[\d\s().-]{7,20}$/.test(v.trim())
const looksLikeEmail = (v: string) => /^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(v.trim())
/** A WhatsApp id is a phone only as `<digits>@s.whatsapp.net` or `@c.us`, or bare digits; `@lid` is no number. */
const WHATSAPP_PHONE = /^(\d{7,15})(?:@s\.whatsapp\.net|@c\.us)?$/

const uniqueBy = (values: string[], key: (v: string) => string) =>
  values.filter((v, i) => key(v) !== "" && values.findIndex((w) => key(w) === key(v)) === i)

/** A person's phones and addresses: what memo's row and context give, and what their accounts are. */
export function contactsOf(
  person: PersonDetail | null,
  profile: PersonProfile | null,
  row: Listed | undefined,
): Contacts {
  const ids = (provider: string) =>
    (person?.identities ?? []).filter((i) => i.provider === provider).map((i) => i.identity.slice(provider.length + 1))
  const contact = row?.contact ?? ""
  const whatsapp = ids("whatsapp").flatMap((id) => {
    const digits = WHATSAPP_PHONE.exec(id)?.[1]
    return digits ? [`+${digits}`] : []
  })
  const own = (key: "phone" | "email") =>
    [row?.[key], ...(person?.identities ?? []).map((i) => i[key])].filter((v): v is string => !!v)
  const phones = [
    ...(profile?.phones ?? []),
    ...own("phone"),
    ...(looksLikePhone(contact) ? [contact] : []),
    ...whatsapp,
  ]
  const emails = [
    ...(profile?.emails ?? []),
    ...own("email"),
    ...(looksLikeEmail(contact) ? [contact] : []),
    ...ids("email"),
  ]
  return { phones: uniqueBy(phones, phoneKey), emails: uniqueBy(emails, emailKey) }
}

/**
 * The value the people share, as memo named it, else a phone or address two of them have. `null` when neither is
 * known: the dialog then says only what kind of thing they share, and marks the accounts the match names.
 */
export function sharedValue(match: Match, contacts: Contacts[]): string | null {
  const phone = match.signal === "phone"
  if (!phone && match.signal !== "email" && match.signal !== "guest-email") return null
  // memo's evidence may be a reference (a meeting's) rather than the value: only a phone or an address is shown.
  const evidence = match.evidence.find(phone ? looksLikePhone : looksLikeEmail)
  if (evidence) return evidence
  const key = keyOf(match.signal)
  const lists = contacts.map((c) => (phone ? c.phones : c.emails))
  const holders = (v: string) => lists.filter((l) => l.some((w) => key(w) === key(v))).length
  return lists.flat().find((v) => holders(v) > 1) ?? null
}

/** How a shared phone or address is marked where it shows: bold and underlined, no coloured box. */
export const sameMark = "font-semibold text-ink underline decoration-brand/70 decoration-2 underline-offset-[0.25em]"
