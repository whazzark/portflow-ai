import { useRef } from 'react'

/**
 * A resource list that keeps each row it has shown: one the refreshed choices no longer offer stays
 * listed while it is selected, so its refusal remains readable, but it may only be let go of.
 *
 * Generic over the row, because the shift panel's checklist and the door sheet's checkbox group
 * describe a row differently while needing the same memory.
 */
export function useResourceRows<Row extends { id: string }>(
  current: Row[],
  offered: Row[],
  selected: readonly string[],
) {
  const seen = useRef(new Map<string, Row>())
  for (const row of [...current, ...offered]) {
    seen.current.set(row.id, row)
  }

  const offeredIds = new Set(offered.map((row) => row.id))
  const listed = new Set([...current.map((row) => row.id), ...offeredIds, ...selected])

  return [...seen.current.values()]
    .filter((row) => listed.has(row.id))
    .map((row) => ({ ...row, canCheck: offeredIds.has(row.id) }))
}
