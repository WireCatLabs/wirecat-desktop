// The release body is Markdown for GitHub; the update dialog shows plain text, and the long "All changes" list stays
// behind the "What's new" link.
export function plainNotes(body: string | undefined): string | null {
  const [summary = ""] = (body ?? "").split(/^## All changes\b/m)
  const text = summary
    .replace(/^#{1,6}\s+(.*)$/gm, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}
