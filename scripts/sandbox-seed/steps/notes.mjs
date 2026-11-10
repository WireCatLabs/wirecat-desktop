import { join } from "node:path"
import { memo, writeIfChanged } from "../lib.mjs"

export default function notes(ctx) {
  const dir = join(ctx.home, "Notes")
  let written = 0
  for (const note of ctx.data("notes.json")) if (writeIfChanged(join(dir, note.file), note.text)) written++
  memo(["folders", "add", dir])
  memo(["sync", "--only", "notes", "--no-embed"])
  return `${written} note files written in ${dir}`
}
