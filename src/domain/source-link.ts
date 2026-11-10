// Where the owner can open an account in its own app. memo names a Bitrix24 contact by its portal and id
// (`bitrix24:portal.example/contact/42`, older stores the page's address); Telegram by a public username.

const HOST = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
const BITRIX = /^(?:https:\/\/)?([^/]+)\/(?:crm\/)?(contact|company|lead|deal)\/(?:details\/)?(\d{1,15})\/?$/
const USERNAME = /^[A-Za-z][A-Za-z0-9_]{3,31}$/

/** The https page of an account, or null when there is none to open or memo's id does not look as expected. */
export function sourceLink(identity: string, username?: string | null): string | null {
  const colon = identity.indexOf(":")
  const provider = identity.slice(0, colon)
  const id = identity.slice(colon + 1)
  if (provider === "bitrix24") {
    const [, host = "", kind, number] = BITRIX.exec(id) ?? []
    return HOST.test(host.toLowerCase()) ? `https://${host.toLowerCase()}/crm/${kind}/details/${number}/` : null
  }
  const name = username?.replace(/^@/, "")
  if (provider === "telegram" && name && USERNAME.test(name)) return `https://t.me/${name}`
  return null
}
