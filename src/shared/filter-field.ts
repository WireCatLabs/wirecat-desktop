import { setField, valuesOf } from "@/domain/query-terms"
import type { FilterOption } from "@/ui/FilterMenu"

/**
 * A `FilterMenu`'s choice, read from and written into a `FilterBar`'s text as `field:value` words, so the chip and the
 * typed text are one state. Each option brings its own count.
 */
export const filterField = (
  query: string,
  onQuery: (query: string) => void,
  field: string,
  options: readonly FilterOption[],
) => ({
  selected: valuesOf(query, field),
  onChange: (chosen: string[]) => onQuery(setField(query, field, chosen)),
  options,
})
