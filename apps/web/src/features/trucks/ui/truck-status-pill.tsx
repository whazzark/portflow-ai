import { StatusIndicator } from '@/components/ui/status-indicator'
import type { TruckDto } from '@/features/trucks/types'
import { classnames } from '@/libraries/shadcn/helpers'

export const TRUCK_STATUS_LABELS = {
  AVAILABLE: 'Available',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
} as const satisfies Record<TruckDto['status'], string>

// Green, amber and grey also differ in lightness, and the label always carries the meaning.
const VARIANTS = {
  AVAILABLE: 'success',
  SUSPENDED: 'warning',
  ARCHIVED: 'neutral',
} as const satisfies Record<TruckDto['status'], 'success' | 'warning' | 'neutral'>

export function TruckStatusPill({ status }: { status: TruckDto['status'] }) {
  return (
    <StatusIndicator
      className="whitespace-nowrap"
      label={TRUCK_STATUS_LABELS[status]}
      variant={VARIANTS[status]}
    />
  )
}

/** A registration drawn as a plate, so it reads as an identifier rather than prose. */
export function TruckRegistration({
  registration,
  className,
}: {
  registration: string
  className?: string
}) {
  return (
    <span
      className={classnames(
        'inline-flex h-6 items-center whitespace-nowrap rounded-sm border bg-background px-2 font-medium font-mono text-[13px] tracking-wide',
        className,
      )}
    >
      {registration}
    </span>
  )
}
