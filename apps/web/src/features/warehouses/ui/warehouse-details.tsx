import {
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource-map/resource-details'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { WarehouseLifecycleActions } from '@/features/warehouses/ui/warehouse-lifecycle-actions'
import { formatDateTime } from '@/helpers/dates'

export function WarehouseDetails({
  canManageLifecycle = false,
  warehouse,
}: {
  /** Gates both lifecycle directions — an available warehouse can be archived, an archived one
   * reactivated — so it is named for the right rather than for one of the two actions. */
  canManageLifecycle?: boolean
  warehouse: WarehouseWithDoorsDto
}) {
  const hasLifecycleContext = Boolean(warehouse.archivedAt ?? warehouse.reactivatedAt)

  return (
    <div className="shrink-0">
      <ResourceDetailHeader
        archivedMessage="Archived warehouses cannot receive new operations."
        name={warehouse.name}
        status={warehouse.status}
      />
      {hasLifecycleContext && (
        <section aria-labelledby="warehouse-lifecycle-heading" className="px-4 pt-4">
          <h3 className="font-medium text-sm" id="warehouse-lifecycle-heading">
            Lifecycle
          </h3>
          <Separator className="my-3" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <ResourceDetailField
              label="Archived"
              value={warehouse.archivedAt ? formatDateTime(warehouse.archivedAt) : null}
            />
            <ResourceDetailField label="Archive comment" value={warehouse.archiveComment} />
            {warehouse.reactivatedAt && (
              <>
                <ResourceDetailField
                  label="Reactivated"
                  value={formatDateTime(warehouse.reactivatedAt)}
                />
                <ResourceDetailField
                  label="Reactivation comment"
                  value={warehouse.reactivationComment}
                />
              </>
            )}
          </dl>
        </section>
      )}
      {canManageLifecycle && (
        <SheetFooter className="shrink-0 sm:flex-row sm:items-center sm:justify-end">
          <WarehouseLifecycleActions warehouse={warehouse} />
        </SheetFooter>
      )}
    </div>
  )
}
