import { useEffect, useRef } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  detailTabCounts,
  isDischargeDetailTab,
} from '@/features/discharges/discharge-detail-sections'
import {
  DISCHARGE_DETAIL_TABS,
  type DischargeDetailDto,
  type DischargeDetailTab,
} from '@/features/discharges/types'
import { DischargeIdentityCard } from '@/features/discharges/ui/detail/discharge-identity-card'
import { DischargePreparationCard } from '@/features/discharges/ui/detail/discharge-preparation-card'
import { DischargeProductLotsCard } from '@/features/discharges/ui/detail/discharge-product-lots-card'
import { DischargeShiftsCard } from '@/features/discharges/ui/detail/discharge-shifts-card'
import { DischargeTruckPoolCard } from '@/features/discharges/ui/detail/discharge-truck-pool-card'

const TAB_LABELS = {
  overview: 'Overview',
  'product-lots': 'Product lots',
  'truck-pool': 'Truck pool',
  shifts: 'Shifts',
} as const satisfies Record<DischargeDetailTab, string>

type DischargeDetailTabsProps = {
  discharge: DischargeDetailDto
  /** Whether the viewer may correct this discharge now: a preparer, on a planned discharge. */
  canCorrect: boolean
  /** Whether the viewer may add shifts now: a preparer, on a discharge that is not closed. */
  canAddShifts: boolean
  tab: DischargeDetailTab
  onTabChange: (tab: DischargeDetailTab) => void
}

/**
 * One section of the discharge at a time. An inactive section is not mounted, so its sheets and
 * selections are left behind with it, as leaving the page would.
 */
export function DischargeDetailTabs({
  discharge,
  canCorrect,
  canAddShifts,
  tab,
  onTabChange,
}: DischargeDetailTabsProps) {
  const counts = detailTabCounts(discharge)
  const tabList = useRef<HTMLDivElement>(null)

  // A shared address may open a section whose tab lies past a narrow screen's edge.
  useEffect(() => {
    tabList.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [])

  const changeTab = (value: unknown) => {
    if (typeof value === 'string' && isDischargeDetailTab(value)) {
      onTabChange(value)
    }
  }

  return (
    <Tabs onValueChange={changeTab} value={tab}>
      {/* Scrolls sideways on a narrow screen rather than shortening names; the bottom padding keeps
          the active tab's underline, drawn below the list, out of the clipped area. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1.5 md:mx-0 md:px-0" ref={tabList}>
        <TabsList aria-label="Discharge sections" className="w-max" variant="line">
          {DISCHARGE_DETAIL_TABS.map((value) => {
            const count = value === 'overview' ? null : counts[value]

            return (
              <TabsTrigger key={value} value={value}>
                {TAB_LABELS[value]}
                {count !== null && (
                  <>
                    {' '}
                    <span className="text-muted-foreground tabular-nums">({count})</span>
                  </>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>
      <TabsContent className="grid gap-6" value="overview">
        <DischargeIdentityCard discharge={discharge} />
        {discharge.status === 'PLANNED' && <DischargePreparationCard discharge={discharge} />}
      </TabsContent>
      <TabsContent value="product-lots">
        <DischargeProductLotsCard canCorrect={canCorrect} discharge={discharge} />
      </TabsContent>
      <TabsContent value="truck-pool">
        <DischargeTruckPoolCard canCorrect={canCorrect} discharge={discharge} />
      </TabsContent>
      <TabsContent value="shifts">
        <DischargeShiftsCard
          canAddShifts={canAddShifts}
          canCorrect={canCorrect}
          discharge={discharge}
        />
      </TabsContent>
    </Tabs>
  )
}
