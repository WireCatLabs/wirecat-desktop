import * as v from "valibot"

const LocalizedSchema = v.object({ en: v.string(), ru: v.optional(v.string()), es: v.optional(v.string()) })

/** Rust passes only plain https links on; checked again here because the link goes to `openUrl`. */
const HttpsSchema = v.pipe(v.string(), v.regex(/^https:\/\/[^\s/][^\s]*$/))

export const NotificationSchema = v.object({
  id: v.string(),
  severity: v.picklist(["info", "update", "security"]),
  title: LocalizedSchema,
  body: LocalizedSchema,
  link: v.nullable(v.object({ url: HttpsSchema, label: v.partial(LocalizedSchema) })),
  publishedAt: v.string(),
  expiresAt: v.nullable(v.string()),
})

export const NotificationsSchema = v.array(NotificationSchema)

export type Localized = v.InferOutput<typeof LocalizedSchema>
export type Notification = v.InferOutput<typeof NotificationSchema>
