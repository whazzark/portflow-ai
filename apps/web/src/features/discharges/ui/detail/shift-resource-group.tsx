import type { ReactNode } from 'react'

import { splitPeriods } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { EffectivePeriod } from '@/features/discharges/ui/detail/effective-period'

type Period = { id: string; effectiveFrom: string | null; effectiveTo: string | null }

type ShiftResourceGroupProps<T extends Period> = {
  dischargeStatus: DischargeDetailDto['status']
  label: string
  periods: T[]
  renderResource: (period: T) => ReactNode
  /** An action on this group of resources, placed beside its label. */
  action?: ReactNode
}

/** One kind of resource a shift uses, each with the period it was used for. */
export function ShiftResourceGroup<T extends Period>({
  dischargeStatus,
  label,
  periods,
  renderResource,
  action,
}: ShiftResourceGroupProps<T>) {
  const { inEffect, ended } = splitPeriods(periods, dischargeStatus)

  return (
    <div className="grid content-start gap-1">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-muted-foreground">{label}</h4>
        {action}
      </div>
      {periods.length > 0 ? (
        <ul aria-label={label} className="grid gap-1">
          {[...inEffect, ...ended].map((period) => (
            <li className="grid gap-0.5" key={period.id}>
              {renderResource(period)}
              <EffectivePeriod dischargeStatus={dischargeStatus} period={period} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">None selected</p>
      )}
    </div>
  )
}
