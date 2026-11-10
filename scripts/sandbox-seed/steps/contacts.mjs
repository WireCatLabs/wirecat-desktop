import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { memo, memoAll, SeedError } from "../lib.mjs"

export const ACCOUNT = { provider: "seed", account: "demo" }

const record = (version, type, id, fields, relations = []) => ({
  key: `${type}:${id}`,
  type,
  external_id: id,
  operation: "upsert",
  revision: version,
  fields,
  relations,
})

const personFields = ({ name, email, phone, position }) => ({
  name,
  ...(email && { email }),
  ...(phone && { phone }),
  ...(position && { position }),
})

/**
 * Organizations and people as one records envelope: matched by e-mail, phone or domain, made otherwise, and keyed by
 * the seed id, so the same file twice changes nothing.
 */
export function importEnvelope(ctx, source, records) {
  const envelope = { schema_version: 1, source: { ...source, batch_id: `seed-v${ctx.version}` }, records }
  const dir = join(ctx.home, ".cache", "sandbox-seed")
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${source.provider}-${source.account}.json`)
  writeFileSync(file, JSON.stringify(envelope))
  const receipt = memo(["records", "import", file, "--account", `${source.provider}:${source.account}`]).item
  if (receipt.errors.length || receipt.refused) {
    const first = receipt.errors[0]
    const hint =
      first?.code === "record.stale-revision"
        ? " (after an edit, raise version in data/seed.json; a sandbox at a newer version needs --reset)"
        : ""
    throw new SeedError(`records import ${source.provider}:${source.account}: ${first?.message ?? "refused"}${hint}`)
  }
  return receipt
}

export default function contacts(ctx) {
  const { people, automated, companies } = ctx.data("people.json")
  const orgs = ctx.data("organizations.json")
  const v = ctx.version
  const records = [
    ...orgs.map((o) =>
      record(v, "organization", o.id, { name: o.name, identifiers: [{ scheme: "domain", value: o.domain }] }),
    ),
    ...[...people, ...automated, ...companies].map((p) =>
      record(
        v,
        "person",
        p.id,
        personFields(p),
        p.organization ? [{ role: "member-of", type: "organization", external_id: p.organization }] : [],
      ),
    ),
  ]
  const r = importEnvelope(ctx, ACCOUNT, records)
  for (const row of memoAll(["records", "list", "--account", `${ACCOUNT.provider}:${ACCOUNT.account}`]))
    if (row.entity) ctx.refs.set(row.external_id, row.entity)
  return `${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged`
}
