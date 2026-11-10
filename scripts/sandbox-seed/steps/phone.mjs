import { dayOf } from "../lib.mjs"
import { importEnvelope } from "./contacts.mjs"

export const PHONE = { provider: "phone", account: "sandbox-phone" }

/** SMS are the one chat message a file may bring in: the store takes them only under an import-only provider. */
export const smsRef = (m) => `msg:${PHONE.provider}/${PHONE.account}/${encodeURIComponent(m.phone)}/${m.id}`

export default function phone(ctx) {
  const { messages } = ctx.data("phone.json")
  const records = messages.map((m) => ({
    key: m.id,
    type: "message",
    external_id: m.id,
    operation: "upsert",
    revision: ctx.version,
    fields: {
      kind: "sms",
      direction: m.direction,
      phone: m.phone,
      name: m.name,
      body: m.body,
      sent_at: dayOf(ctx.anchor, m.days_ago, m.time).toISOString(),
      ...(m.read !== undefined && { read: m.read }),
    },
  }))
  const r = importEnvelope(ctx, PHONE, records)
  return `${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged`
}
