// Where the owner can open an account in its own app. memo names a Bitrix24 contact by its portal and id
// (`bitrix24:portal.example/contact/42`, older stores the page's address), a portal's user as `portal.example/user/7`;
// Telegram by a public username, WhatsApp by a phone number, mail by its address.

const HOST = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
const BITRIX = /^(?:https:\/\/)?([^/]+)\/(?:crm\/)?(contact|company|lead|deal)\/(?:details\/)?(\d{1,15})\/?$/
const BITRIX_USER = /^(?:https:\/\/)?([^/]+)\/(?:company\/personal\/)?user\/(\d{1,15})\/?$/
const USERNAME = /^[A-Za-z][A-Za-z0-9_]{3,31}$/
const WHATSAPP = /^(\d{7,15})(?:@s\.whatsapp\.net|@c\.us)?$/
// Only what the desktop's mailto check lets through: an address with no query a mail program could act on.
const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/

const split = (identity: string) => {
  const colon = identity.indexOf(":")
  return { provider: identity.slice(0, colon), id: identity.slice(colon + 1) }
}

/** The page of an account (https, or mailto for an address), or null when there is none or the id looks unexpected. */
export function sourceLink(identity: string, username?: string | null): string | null {
  const { provider, id } = split(identity)
  if (provider === "bitrix24") {
    const [, host = "", kind, number] = BITRIX.exec(id) ?? []
    if (kind)
      return HOST.test(host.toLowerCase()) ? `https://${host.toLowerCase()}/crm/${kind}/details/${number}/` : null
    const [, userHost = "", user] = BITRIX_USER.exec(id) ?? []
    return user && HOST.test(userHost.toLowerCase())
      ? `https://${userHost.toLowerCase()}/company/personal/user/${user}/`
      : null
  }
  if (provider === "whatsapp") {
    const phone = WHATSAPP.exec(id)?.[1]
    return phone ? `https://wa.me/${phone}` : null
  }
  if (provider === "email") return EMAIL.test(id) ? `mailto:${id}` : null
  const name = username?.replace(/^@/, "")
  if (provider === "telegram" && name && USERNAME.test(name)) return `https://t.me/${name}`
  return null
}

/** What a copy button copies: the address, phone or handle a person would type, else the page, else memo's id. */
export function accountValue(identity: string, username?: string | null): string {
  const { provider, id } = split(identity)
  if (provider === "email") return id
  if (provider === "phone") return id.startsWith("+") ? id : `+${id}`
  const phone = provider === "whatsapp" ? WHATSAPP.exec(id)?.[1] : null
  if (phone) return `+${phone}`
  const handle = username?.trim().replace(/^@/, "")
  if (handle) return `@${handle}`
  return sourceLink(identity, username) ?? id
}
