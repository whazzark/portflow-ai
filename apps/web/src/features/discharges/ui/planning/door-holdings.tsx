import { TriangleAlertIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PlanningDoorDto } from '@/features/discharges/types'
import { DISCHARGE_STATUS_LABELS } from '@/features/discharges/ui/detail/discharge-status-badge'
import { formatDateTime } from '@/helpers/dates'

type DoorHoldingsProps = {
  assignments: PlanningDoorDto['otherDischargeAssignments']
}

/**
 * One sentence per competing discharge, read with the door but not shown: the marker beside the
 * door carries the same fact to the eye, and spelling both out is what buried the door's name.
 */
export function doorHoldingHints(assignments: DoorHoldingsProps['assignments']) {
  return assignments.map(({ discharge }) => ({
    text: `Also assigned to ${discharge.vesselName} (${DISCHARGE_STATUS_LABELS[discharge.status]}, expected ${formatDateTime(discharge.expectedStartAt)})`,
    visuallyHidden: true,
  }))
}

/**
 * The other discharges a door is already assigned to. Several plans may hold one door at once —
 * nothing here refuses it — so the competition is a marker beside the door rather than a paragraph
 * under it: a door with nothing beside it is one nobody else expects.
 */
export function DoorHoldings({ assignments }: DoorHoldingsProps) {
  if (assignments.length === 0) {
    return null
  }

  const labels = assignments.map(
    ({ discharge }) => `${discharge.vesselName} · ${DISCHARGE_STATUS_LABELS[discharge.status]}`,
  )

  return (
    <Tooltip>
      <TooltipTrigger
        // The count is spoken by the hints tied to the checkbox, so this only needs to be reachable.
        aria-label={`Also assigned to ${labels.join(', ')}`}
        className="inline-flex items-center gap-1 rounded-sm text-sm text-warning outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
      >
        <TriangleAlertIcon aria-hidden="true" className="size-4" />
        {assignments.length}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start">
        <span className="font-medium">Also assigned to</span>
        <ul>
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <span>Several plans may hold one door; the discharge that starts first uses it.</span>
      </TooltipContent>
    </Tooltip>
  )
}
