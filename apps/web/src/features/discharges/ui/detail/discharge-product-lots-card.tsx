import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  formatTonnes,
  type LotDoorNotice,
  lotDoorNotice,
  splitPeriods,
} from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { EffectivePeriod } from '@/features/discharges/ui/detail/effective-period'
import { ProductLotSheet } from '@/features/discharges/ui/detail/product-lot-sheet'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { RemoveProductLotDialog } from '@/features/discharges/ui/detail/remove-product-lot-dialog'

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
  /** Whether the viewer may change this discharge's lots now: a preparer, on a planned discharge. */
  canCorrect: boolean
}

type LotEditing = { mode: 'add' } | { mode: 'edit'; lot: ProductLot } | null

export function DischargeProductLotsCard({ discharge, canCorrect }: DischargeProductLotsCardProps) {
  const [editing, setEditing] = useState<LotEditing>(null)
  const [removing, setRemoving] = useState<ProductLot | null>(null)
  const lastLotNoteId = useId()
  const isLastLot = discharge.productLots.length === 1

  const addButton = (
    <Button onClick={() => setEditing({ mode: 'add' })} size="sm" variant="outline">
      Add product lot
    </Button>
  )

  return (
    <DetailSection actions={canCorrect ? addButton : undefined} title="Product lots">
      {discharge.productLots.length > 0 ? (
        <div className="grid gap-4">
          {discharge.productLots.map((lot) => {
            const lotName = `${lot.customer.name} · ${lot.productName}`

            return (
              <article
                aria-label={lotName}
                className="grid gap-3 rounded-lg border p-4"
                key={lot.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid gap-1">
                    <h3 className="font-medium">{lot.productName}</h3>
                    <ReferenceLabel name={lot.customer.name} status={lot.customer.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatTonnes(lot.expectedQuantityTonnes)}
                    </span>
                    {canCorrect && (
                      <>
                        <Button
                          aria-label={`Edit ${lotName}`}
                          onClick={() => setEditing({ mode: 'edit', lot })}
                          size="sm"
                          variant="ghost"
                        >
                          Edit
                        </Button>
                        <Button
                          aria-describedby={isLastLot ? lastLotNoteId : undefined}
                          aria-label={`Remove ${lotName}`}
                          disabled={isLastLot}
                          onClick={() => setRemoving(lot)}
                          size="sm"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <p>
                  {lot.description ?? (
                    <span className="text-muted-foreground italic">Not specified</span>
                  )}
                </p>
                <LotDoors dischargeStatus={discharge.status} lot={lot} />
              </article>
            )
          })}
          {/* A disabled button cannot show a tooltip, so the reason is written out and tied to it. */}
          {canCorrect && isLastLot && (
            <p className="text-muted-foreground text-sm" id={lastLotNoteId}>
              A discharge needs at least one product lot
            </p>
          )}
        </div>
      ) : (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No product lots</EmptyTitle>
            <EmptyDescription>
              No product lot has been prepared for this discharge yet.
            </EmptyDescription>
          </EmptyHeader>
          {canCorrect && <EmptyContent>{addButton}</EmptyContent>}
        </Empty>
      )}
      {canCorrect && (
        <ProductLotSheet
          discharge={discharge}
          lot={editing?.mode === 'edit' ? editing.lot : undefined}
          onOpenChange={(open) => !open && setEditing(null)}
          open={editing !== null}
        />
      )}
      {canCorrect && removing && (
        <RemoveProductLotDialog
          discharge={discharge}
          lot={removing}
          onClose={() => setRemoving(null)}
        />
      )}
    </DetailSection>
  )
}
