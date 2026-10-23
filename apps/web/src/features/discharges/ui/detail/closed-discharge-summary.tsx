import { LockIcon } from 'lucide-react'

import { closedDischargeSummary } from '@/features/discharges/closed-discharge-record'
import { formatTonnes } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto, DischargeDetailTab } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { formatDateTime } from '@/helpers/dates'

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** Names in a sentence: `A`, `A and B`, `A, B and C`. */
function listed(names: string[]) {
  return names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

type SummaryRowProps = {
  tab: DischargeDetailTab
  label: string
  facts: (string | null)[]
}

function SummaryRow({ tab, label, facts }: SummaryRowProps) {
  return (
    <li className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <DischargeTabLink className="font-medium underline-offset-4 hover:underline" tab={tab}>
        {label}
      </DischargeTabLink>
      <div className="grid gap-1">
        {facts.map(
          (fact, index) =>
            fact && (
              <span className={index > 0 ? 'text-muted-foreground' : undefined} key={fact}>
                {fact}
              </span>
            ),
        )}
      </div>
    </li>
  )
}

/** What a closed discharge involved, section by section, each a way into its section. */
export function ClosedDischargeSummary({ discharge }: { discharge: DischargeDetailDto }) {
  const summary = closedDischargeSummary(discharge)

  return (
    <DetailSection title="Summary">
      <p className="mb-4 inline-flex items-center gap-1.5 text-muted-foreground text-sm">
        <LockIcon aria-hidden="true" className="size-4 shrink-0" />
        Closed discharges are read-only
      </p>
      <ul className="divide-y">
        <SummaryRow
          facts={[counted(summary.shifts, 'shift', 'shifts')]}
          label="Shifts"
          tab="shifts"
        />
        <SummaryRow
          facts={[
            `${counted(summary.lots, 'lot', 'lots')} · ${counted(summary.customers, 'customer', 'customers')} · ${formatTonnes(summary.expectedTotal)}`,
            summary.doors.length > 0
              ? `Unloaded through ${listed(summary.doors.map((door) => door.name))}`
              : null,
          ]}
          label="Product lots"
          tab="product-lots"
        />
        <SummaryRow
          facts={[
            counted(summary.trucks, 'truck', 'trucks'),
            summary.allReleasedAt
              ? `All released on ${formatDateTime(summary.allReleasedAt)}`
              : null,
          ]}
          label="Truck pool"
          tab="truck-pool"
        />
      </ul>
    </DetailSection>
  )
}
