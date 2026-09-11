import { Badge } from '@/components/ui/badge'
import type { DischargeDetailDto } from '@/features/discharges/types'

type DischargeStatus = DischargeDetailDto['status']
type ShiftStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED'

const DISCHARGE_STATUS_LABELS = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  PLANNED: 'Planned',
} as const satisfies Record<DischargeStatus, string>

const SHIFT_STATUS_LABELS = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  PLANNED: 'Planned',
} as const satisfies Record<ShiftStatus, string>

// Work under way stands out; what is prepared or finished reads quietly. The label carries the
// meaning either way, so the variant is emphasis and never the only signal.
const VARIANTS = {
  ACTIVE: 'default',
  CLOSED: 'outline',
  COMPLETED: 'outline',
  PLANNED: 'secondary',
} as const satisfies Record<DischargeStatus | ShiftStatus, 'default' | 'secondary' | 'outline'>

export function DischargeStatusBadge({ status }: { status: DischargeStatus }) {
  return <Badge variant={VARIANTS[status]}>{DISCHARGE_STATUS_LABELS[status]}</Badge>
}

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return <Badge variant={VARIANTS[status]}>{SHIFT_STATUS_LABELS[status]}</Badge>
}
