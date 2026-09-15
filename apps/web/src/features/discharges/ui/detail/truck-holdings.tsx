import { TriangleAlertIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
 * appearing only on the day a discharge starts.
 */
export function TruckHoldings({ holdings }: TruckHoldingsProps) {
  if (holdings.length === 0) {
    return null
  }

  const labels = holdings.map(
    (holding) => `${holding.vesselName} · ${HOLDING_STATUS_LABELS[holding.status]}`,
  )

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`Also held by ${labels.join(', ')}`}
        className="inline-flex rounded-sm text-warning outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
      >
        <TriangleAlertIcon aria-hidden="true" className="size-4" />
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start">
        <span className="font-medium">Also held by</span>
        <ul>
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <span>Only one active discharge can hold a truck, so starting a discharge settles it.</span>
      </TooltipContent>
    </Tooltip>
  )
}
