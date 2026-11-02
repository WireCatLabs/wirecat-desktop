import { CARDS, type CardId } from "./layout"

/** Strips that read across the page: they take a whole row of a section's grid. */
const WIDE: readonly CardId[] = ["week"]

export function Cards({ ids }: { ids: readonly CardId[] }) {
  return ids.map((id) => {
    const Card = CARDS[id]
    return WIDE.includes(id) ? (
      <div key={id} className="lg:col-span-2">
        <Card />
      </div>
    ) : (
      <Card key={id} />
    )
  })
}
