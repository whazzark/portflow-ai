import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  formatTonnes,
  type LotDoorNotice,
  lotDoorNotice,
  splitPeriods,
} from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { EffectivePeriod } from '@/features/discharges/ui/detail/effective-period'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'

type ProductLot = DischargeDetailDto['productLots'][number]

const DOOR_NOTICES = {
  NONE_ASSIGNED: 'No warehouse door assigned',
  NONE_CURRENTLY_ASSIGNED: 'No warehouse door currently assigned',
} as const satisfies Record<LotDoorNotice, string>

function LotDoors({
  lot,
  dischargeStatus,
}: {
  lot: ProductLot
  dischargeStatus: DischargeDetailDto['status']
}) {
  const { inEffect, ended } = splitPeriods(lot.doorAssignments, dischargeStatus)
  const notice = lotDoorNotice(lot, dischargeStatus)

  return (
    <div className="grid gap-2">
      {lot.doorAssignments.length > 0 && (
        <ul aria-label="Warehouse doors" className="grid gap-1">
          {[...inEffect, ...ended].map((assignment) => (
            <li
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
              key={assignment.id}
            >
              <span className="inline-flex flex-wrap items-center gap-1">
                <ReferenceLabel
                  name={assignment.warehouse.name}
                  status={assignment.warehouse.status}
                />
                {' › '}
                <ReferenceLabel
                  name={assignment.warehouseDoor.name}
                  status={assignment.warehouseDoor.status}
                />
              </span>
              <EffectivePeriod dischargeStatus={dischargeStatus} period={assignment} />
            </li>
          ))}
        </ul>
      )}
      {notice && <p className="text-muted-foreground">{DOOR_NOTICES[notice]}</p>}
    </div>
  )
}

type DischargeProductLotsCardProps = {
  discharge: DischargeDetailDto
}

export function DischargeProductLotsCard({ discharge }: DischargeProductLotsCardProps) {
  return (
    <DetailSection title="Product lots">
      {discharge.productLots.length > 0 ? (
        <div className="grid gap-4">
          {discharge.productLots.map((lot) => (
            <article
              aria-label={`${lot.customer.name} · ${lot.productName}`}
              className="grid gap-3 rounded-lg border p-4"
              key={lot.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-1">
                  <h3 className="font-medium">{lot.productName}</h3>
                  <ReferenceLabel name={lot.customer.name} status={lot.customer.status} />
                </div>
                <span className="font-medium tabular-nums">
                  {formatTonnes(lot.expectedQuantityTonnes)}
                </span>
              </div>
              <p>
                {lot.description ?? (
                  <span className="text-muted-foreground italic">Not specified</span>
                )}
              </p>
              <LotDoors dischargeStatus={discharge.status} lot={lot} />
            </article>
          ))}
        </div>
      ) : (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No product lots</EmptyTitle>
            <EmptyDescription>
              No product lot has been prepared for this discharge yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </DetailSection>
  )
}
