const UNITS = ["bytes", "KB", "MB", "GB", "TB"]

/** Digits in threes split by a no-break space in every language: English's comma and Spanish's dot read as noise here. */
export const groupDigits = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}

/** A line cut into its text and the https links in it, so each link can be a button of its own. */
export function linkParts(text: string): { text: string; url: boolean; at: number }[] {
  let at = 0
  return text
    .split(/(https:\/\/[^\s<>"]*[^\s<>".,;:!?)])/)
    .filter((part) => part !== "")
    .map((part) => {
      const piece = { text: part, url: part.startsWith("https://"), at }
      at += part.length
      return piece
    })
}
