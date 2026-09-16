import { lotDoorChangeSummary, lotLabel } from '@/features/discharges/discharge-planning-view'
import type { DischargeDetailDto } from '@/features/discharges/types'

type ProductLot = DischargeDetailDto['productLots'][number]

type LotDoorChangeSummaryProps = {
  discharge: DischargeDetailDto
  lot: ProductLot
  chosenIds: string[]
  nameOf: (doorId: string) => string
}

/**
 * What the save will change, by door, beside it. The sheet's one live region: each Remove, Undo, or
 * checkbox is announced here once, and a door taken from another lot is said before the request.
 */
export function LotDoorChangeSummary({
  chosenIds,
  discharge,
  lot,
  nameOf,
}: LotDoorChangeSummaryProps) {
  const { adds, moves, removes } = lotDoorChangeSummary(discharge, lot, chosenIds, nameOf)
  const changes = [
    adds.length > 0 ? `Adds ${adds.join(', ')}` : null,
    removes.length > 0 ? `Removes ${removes.join(', ')}` : null,
  ].filter((change) => change !== null)

  const bySource = new Map<string, string[]>()
  for (const move of moves) {
    const source = lotLabel(move.fromLot)
    bySource.set(source, [...(bySource.get(source) ?? []), move.door])
  }

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="grid min-w-0 basis-full gap-0.5 text-sm sm:mr-auto sm:flex-1 sm:basis-auto"
    >
      {changes.length > 0 && <p>{changes.join(' · ')}</p>}
      {[...bySource].map(([source, doors]) => (
        <p className="text-warning" key={source}>
          {doors.join(', ')} {doors.length === 1 ? 'moves' : 'move'} from {source}
        </p>
      ))}
    </div>
  )
}
