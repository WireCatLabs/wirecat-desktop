import { join } from "node:path"
import { files, writeIfChanged } from "../lib.mjs"

export default function notes(ctx) {
  const dir = join(ctx.home, "Notes")
  let written = 0
  for (const note of ctx.data("notes.json")) if (writeIfChanged(join(dir, note.file), note.text)) written++
  files(["folders", "add", dir])
  files(["sync", "--no-embed"])
  return `${written} note files written in ${dir}`
}
