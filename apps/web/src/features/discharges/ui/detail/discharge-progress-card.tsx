import type { ReactNode } from 'react'

import { dischargeProgress } from '@/features/discharges/active-discharge-view'
import {
  formatShiftDay,
  formatShiftTime,
  formatTonnes,
} from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto, DischargeDetailTab } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { formatDateTime } from '@/helpers/dates'

type DischargeProgressCardProps = {
  discharge: DischargeDetailDto
}

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

type ProgressRowProps = {
  label: string
  tab: DischargeDetailTab
  fact: string
  detail: ReactNode
}

/** One section of the discharge, summed up, with the way to it. */
function ProgressRow({ label, tab, fact, detail }: ProgressRowProps) {
  return (
    <li className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <DischargeTabLink
        className="font-medium text-indicator text-sm underline-offset-4 hover:underline"
        tab={tab}
      >
        {label}
      </DischargeTabLink>
      <div className="grid gap-0.5 text-sm">
        <span className="tabular-nums">{fact}</span>
        {detail && <span className="text-muted-foreground">{detail}</span>}
      </div>
    </li>
  )
}

/**
 * The overview's last card on a started discharge: its shifts, product lots, and truck pool summed
 * up from what its record already holds. Unloaded quantities belong to the progress figures to come.
 */
export function DischargeProgressCard({ discharge }: DischargeProgressCardProps) {
  const { shifts, lots, trucks } = dischargeProgress(discharge)
  const released = trucks.released

  return (
    <DetailSection title="Progress">
      <div className="grid gap-3">
        <p className="text-muted-foreground text-sm">
          Read-only while active, except adding shifts
        </p>
        <ul className="grid divide-y">
          <ProgressRow
            detail={
              shifts.plannedEnd &&
              `Ends ${formatShiftDay(new Date(shifts.plannedEnd))} at ${formatShiftTime(shifts.plannedEnd)} as planned`
            }
            fact={[
              counted(shifts.total, 'shift', 'shifts'),
              `${shifts.completed} completed`,
              `${shifts.active} active`,
              `${shifts.planned} planned`,
            ].join(' · ')}
            label="Shifts"
            tab="shifts"
          />
          <ProgressRow
            detail={[
              lots.withDoor.count > 0 &&
                `${lots.withDoor.count} with a warehouse door (${lots.withDoor.doorNames.join(', ')})`,
              lots.withoutDoor > 0 && `${lots.withoutDoor} without`,
            ]
              .filter(Boolean)
              .join(' · ')}
            fact={[
              counted(lots.total, 'lot', 'lots'),
              counted(lots.customers, 'customer', 'customers'),
              formatTonnes(lots.expectedTonnage),
            ].join(' · ')}
            label="Product lots"
            tab="product-lots"
          />
          <ProgressRow
            detail={
              released.length > 0 &&
              `${released.length} released ${released
                .map((entry) => `on ${formatDateTime(entry.releasedAt)} (${entry.registration})`)
                .join(', ')}`
            }
            fact={`${counted(trucks.held, 'truck', 'trucks')} held`}
            label="Truck pool"
            tab="truck-pool"
          />
        </ul>
      </div>
    </DetailSection>
  )
}
