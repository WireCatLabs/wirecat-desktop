import type { Lang } from "@/i18n"
import { type BriefKind, editorMessages } from "./messages-editors"
import { MORNING } from "./store"

/** The kind a digest was made from, read back from the name the starter gave it (`freeName` in CreateDigest). */
export const briefKindOf = (name: string | undefined): BriefKind => {
  if (name === undefined || name === MORNING || name.startsWith("daily-digest")) return "daily"
  if (name.startsWith("weekly-digest")) return "weekly"
  return "own"
}

/** What "What to collect" starts from when the digest has no brief yet; it is only saved when the owner saves it. */
export const briefTemplate = (name: string | undefined, lang: Lang) =>
  editorMessages[lang].brief.template[briefKindOf(name)]
