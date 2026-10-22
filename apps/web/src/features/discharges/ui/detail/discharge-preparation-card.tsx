import { TriangleAlertIcon } from 'lucide-react'

import { preparationSummary } from '@/features/discharges/discharge-detail-sections'
import type { DischargeDetailDto, DischargeDetailTab } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { DOCK_TIMELINE_ID } from '@/features/discharges/ui/detail/dock-timeline-card'

function counted(count: number, one: string, many: string, none: string) {
  if (count === 0) {
    return none
  }

  return count === 1 ? `1 ${one}` : `${count} ${many}`
}

type SummaryRowProps = {
  /** The section the row opens, or `dock` for the timeline above, on the same tab. */
  tab: DischargeDetailTab | 'dock'
  label: string
  fact: string | null
  gap: string | null
}

const LINK_CLASS = 'w-fit font-medium underline-offset-4 hover:underline'

/** The dock is managed nowhere else on the page: its row brings the timeline to attention. */
function DockTimelineLink({ children }: { children: string }) {
  return (
    <a
      className={LINK_CLASS}
      href={`#${DOCK_TIMELINE_ID}`}
      onClick={(event) => {
        event.preventDefault()
        const timeline = document.getElementById(DOCK_TIMELINE_ID)
        timeline?.focus()
        timeline?.scrollIntoView?.({ block: 'nearest' })
      }}
    >
      {children}
    </a>
  )
}

function SummaryRow({ tab, label, fact, gap }: SummaryRowProps) {
  return (
    <li className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      {tab === 'dock' ? (
        <DockTimelineLink>{label}</DockTimelineLink>
      ) : (
        <DischargeTabLink className={LINK_CLASS} tab={tab}>
          {label}
        </DischargeTabLink>
      )}
      <div className="grid gap-1">
        {fact && <span>{fact}</span>}
        {/* Said in words beside the icon, so a gap never rests on colour alone; the warning tone
            stays on the icon, where it needs no text contrast. */}
        {gap && (
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
            {gap}
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * What a planned discharge has prepared, section by section, with the gaps the preparation rules
 * already name. It passes no verdict on whether the discharge can start: the start confirmation
 * owns that rule.
 */
export function DischargePreparationCard({ discharge }: { discharge: DischargeDetailDto }) {
  const { dock, productLots, truckPool, shifts } = preparationSummary(discharge)

  return (
    <DetailSection title="Preparation">
      <ul className="divide-y">
        <SummaryRow
          fact={dock.name}
          gap={
            dock.gap?.kind === 'ARCHIVED'
              ? 'Dock archived'
              : dock.gap?.kind === 'HELD'
                ? `Held by ${dock.gap.vesselName} (active)`
                : null
          }
          label="Dock"
          tab="dock"
        />
        <SummaryRow
          fact={counted(productLots.total, 'product lot', 'product lots', 'No product lots')}
          gap={
            productLots.withoutCurrentDoor > 0
              ? `${productLots.withoutCurrentDoor} with no warehouse door currently assigned`
              : null
          }
          label="Product lots"
          tab="product-lots"
        />
        <SummaryRow
          fact={
            truckPool.held > 0
              ? counted(truckPool.held, 'truck reserved', 'trucks reserved', '')
              : null
          }
          gap={truckPool.held === 0 ? 'No trucks reserved' : null}
          label="Truck pool"
          tab="truck-pool"
        />
        <SummaryRow
          fact={counted(shifts.total, 'shift', 'shifts', 'No shifts planned')}
          gap={
            shifts.plannedWithoutTrucks > 0
              ? counted(
                  shifts.plannedWithoutTrucks,
                  'planned shift without a truck selected',
                  'planned shifts without a truck selected',
                  '',
                )
              : null
          }
          label="Shifts"
          tab="shifts"
        />
      </ul>
    </DetailSection>
  )
}
