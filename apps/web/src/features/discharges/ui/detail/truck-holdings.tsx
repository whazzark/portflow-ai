import { TriangleAlertIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import type { DischargeOtherHoldingDto } from '@/features/discharges/types'

const HOLDING_STATUS_LABELS = {
  ACTIVE: 'Active',
  PLANNED: 'Planned',
} as const satisfies Record<DischargeOtherHoldingDto['status'], string>

type TruckHoldingsProps = {
  holdings: DischargeOtherHoldingDto[]
}

/**
 * The other discharges holding a truck. Planned discharges may compete for one truck; the start
 * confirmation settles it, so until then every reader sees the competition rather than a warning
 * appearing only on the day a discharge starts. A popover rather than a tooltip, so it opens on a
 * click, a tap, or the keyboard alike.
 */
export function TruckHoldings({ holdings }: TruckHoldingsProps) {
  if (holdings.length === 0) {
    return null
  }

  const labels = holdings.map(
    (holding) => `${holding.vesselName} · ${HOLDING_STATUS_LABELS[holding.status]}`,
  )

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Also held by ${labels.join(', ')}`}
        className="inline-flex rounded-sm text-warning outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
      >
        <TriangleAlertIcon aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Also held by</PopoverTitle>
        <ul>
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Only one active discharge can hold a truck, so starting a discharge settles it.
        </p>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The same holdings spelled out in a row, where a list of candidates leaves room for them: « Held
 * by MV Mistral · Active », vessels sharing a status named together.
 */
export function TruckHoldingsText({ holdings, id }: TruckHoldingsProps & { id?: string }) {
  if (holdings.length === 0) {
    return null
  }

  const segments = (['ACTIVE', 'PLANNED'] as const)
    .map((status) => ({
      status,
      vessels: holdings
        .filter((holding) => holding.status === status)
        .map((holding) => holding.vesselName),
    }))
    .filter(({ vessels }) => vessels.length > 0)
    .map(({ status, vessels }) => `${vessels.join(', ')} · ${HOLDING_STATUS_LABELS[status]}`)

  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs" id={id}>
      <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
      Held by {segments.join('; ')}
    </span>
  )
}
