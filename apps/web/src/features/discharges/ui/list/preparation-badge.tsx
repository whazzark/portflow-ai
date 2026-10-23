import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

type PreparationBadgeProps = {
  /** The problems the discharge's start check reports now. */
  startProblemCount: number
}

/**
 * Whether a planned discharge could start now, from the same evaluation the start dialog lists.
 * Icon and wording differ as well as the tone, so the two read apart without color.
 */
export function PreparationBadge({ startProblemCount }: PreparationBadgeProps) {
  if (startProblemCount === 0) {
    return (
      <Badge className="bg-success/10 text-success" variant="secondary">
        <CircleCheckIcon aria-hidden="true" data-icon="inline-start" />
        Ready
      </Badge>
    )
  }

  return (
    <Badge className="bg-warning/10 text-warning" variant="secondary">
      <TriangleAlertIcon aria-hidden="true" data-icon="inline-start" />
      {startProblemCount === 1 ? '1 problem' : `${startProblemCount} problems`}
    </Badge>
  )
}
