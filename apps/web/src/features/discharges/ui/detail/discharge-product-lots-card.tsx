import { ContactIcon } from 'lucide-react'
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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatTonnes,
  groupLotsByCustomer,
  lotRemovalBlock,
} from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { AddProductLotsSheet } from '@/features/discharges/ui/detail/add-product-lots-sheet'
import { CustomerProductLotsSheet } from '@/features/discharges/ui/detail/customer-product-lots-sheet'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { LotDoorChips } from '@/features/discharges/ui/detail/lot-door-chips'
import { ProductLotRowActions } from '@/features/discharges/ui/detail/product-lot-row-actions'
import { ProductLotSheet } from '@/features/discharges/ui/detail/product-lot-sheet'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import {
  LOT_REMOVAL_REASONS,
  RemoveProductLotDialog,
} from '@/features/discharges/ui/detail/remove-product-lot-dialog'
import { LotWarehouseDoorsDialog } from '@/features/discharges/ui/planning/lot-warehouse-doors-dialog'

type ProductLot = DischargeDetailDto['productLots'][number]

type DischargeProductLotsCardProps = {
  discharge: DischargeDetailDto
  /** Whether the viewer may change this discharge's lots now: a preparer, on a planned discharge. */
  canCorrect: boolean
}

export function DischargeProductLotsCard({ discharge, canCorrect }: DischargeProductLotsCardProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ProductLot | null>(null)
  const [removing, setRemoving] = useState<ProductLot | null>(null)
  const [correctingCustomerId, setCorrectingCustomerId] = useState<string | null>(null)
  const [planningDoors, setPlanningDoors] = useState<ProductLot | null>(null)
  const tableId = useId()
  const groups = groupLotsByCustomer(discharge.productLots)
  const columnCount = canCorrect ? 4 : 3

  const addButton = (
    <Button onClick={() => setAdding(true)} size="sm">
      Add product lots
    </Button>
  )

  return (
    <DetailSection actions={canCorrect ? addButton : undefined} title="Product lots">
      {discharge.productLots.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Product lots">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Expected quantity</TableHead>
                <TableHead>Warehouse doors</TableHead>
                {canCorrect && (
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            {groups.map((group, groupIndex) => {
              const headerId = `${tableId}-customer-${groupIndex}`

              return (
                // A customer's lots form a group, named by the customer heading its rows.
                <TableBody aria-labelledby={headerId} key={group.customer.id}>
                  {/* A thick rule and the customer icon set each customer apart from the next. */}
                  <TableRow className="border-t-2 bg-muted/40 hover:bg-muted/40">
                    <th className="h-10 px-2 text-left align-middle font-semibold" scope="rowgroup">
                      <span className="inline-flex flex-wrap items-center gap-x-2">
                        <ContactIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                        {/* The group is named by its customer alone, not by its lot count. */}
                        <span id={headerId}>
                          <ReferenceLabel
                            name={group.customer.name}
                            status={group.customer.status}
                          />
                        </span>
                        <span className="font-normal text-muted-foreground">
                          · {group.lots.length} {group.lots.length === 1 ? 'lot' : 'lots'}
                        </span>
                      </span>
                    </th>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatTonnes(group.subtotal)}
                    </TableCell>
                    <TableCell className="text-right" colSpan={columnCount - 2}>
                      {canCorrect && (
                        <Button
                          aria-label={`Edit ${group.customer.name}`}
                          onClick={() => setCorrectingCustomerId(group.customer.id)}
                          size="sm"
                          variant="ghost"
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {group.lots.map((lot) => {
                    const lotName = `${lot.customer.name} · ${lot.productName}`
                    const block = lotRemovalBlock(lot, discharge.productLots.length)

                    return (
                      <TableRow key={lot.id}>
                        <TableCell className="whitespace-normal pl-6 align-top">
                          <span className="grid gap-0.5">
                            <span className="font-medium">{lot.productName}</span>
                            {lot.description && (
                              <span className="text-muted-foreground italic">
                                {lot.description}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {formatTonnes(lot.expectedQuantityTonnes)}
                        </TableCell>
                        <TableCell className="whitespace-normal align-top">
                          <LotDoorChips dischargeStatus={discharge.status} lot={lot} />
                        </TableCell>
                        {canCorrect && (
                          <TableCell className="text-right align-top">
                            <ProductLotRowActions
                              name={lotName}
                              onDoors={() => setPlanningDoors(lot)}
                              onEdit={() => setEditing(lot)}
                              onRemove={() => setRemoving(lot)}
                              removalBlocked={block ? LOT_REMOVAL_REASONS[block] : null}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              )
            })}
            <TableFooter>
              <TableRow>
                <th className="h-10 px-2 text-left align-middle font-medium" scope="row">
                  Expected total
                </th>
                <TableCell className="text-right tabular-nums">
                  {formatTonnes(discharge.expectedTonnage)}
                </TableCell>
                <TableCell colSpan={columnCount - 2} />
              </TableRow>
            </TableFooter>
          </Table>
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
        <AddProductLotsSheet discharge={discharge} onOpenChange={setAdding} open={adding} />
      )}
      {canCorrect && (
        <ProductLotSheet
          discharge={discharge}
          lot={editing ?? undefined}
          onOpenChange={(open) => !open && setEditing(null)}
          open={editing !== null}
        />
      )}
      {canCorrect && (
        <CustomerProductLotsSheet
          customerId={correctingCustomerId}
          discharge={discharge}
          onOpenChange={(open) => !open && setCorrectingCustomerId(null)}
        />
      )}
      {canCorrect && (
        <LotWarehouseDoorsDialog
          discharge={discharge}
          lot={planningDoors}
          onOpenChange={(open) => !open && setPlanningDoors(null)}
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
