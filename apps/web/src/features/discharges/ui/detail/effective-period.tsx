import { formatPeriod, isInEffect } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'

type EffectivePeriodProps = {
  period: { effectiveFrom: string | null; effectiveTo: string | null }
  dischargeStatus: DischargeDetailDto['status']
}

/** Muted once ended, and said in words too, so the state never rests on colour alone. */
export function EffectivePeriod({ period, dischargeStatus }: EffectivePeriodProps) {
  if (isInEffect(period, dischargeStatus)) {
    return (
      <span className="text-muted-foreground text-sm">{formatPeriod(period, dischargeStatus)}</span>
    )
  }

  return (
    <span className="text-muted-foreground text-sm">
      <span className="font-medium">Ended</span> · {formatPeriod(period, dischargeStatus)}
    </span>
  )
}
