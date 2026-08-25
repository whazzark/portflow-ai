import {
  ResourceDetailBody,
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource-map/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
import type { DockDto } from '@/features/docks/types'
import { DockLifecycleActions } from '@/features/docks/ui/dock-lifecycle-actions'
import { formatDateTime } from '@/helpers/dates'

export function DockDetails({
  canEdit,
  dock,
  onEdit,
}: {
  canEdit: boolean
  dock: DockDto
  onEdit: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceDetailHeader
        archivedMessage="Archived docks cannot receive new operations."
        name={dock.name}
        status={dock.status}
      />
      <ResourceDetailBody>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <ResourceDetailField label="Latitude" value={String(dock.latitude)} />
          <ResourceDetailField label="Longitude" value={String(dock.longitude)} />
          <ResourceDetailField label="Created" value={formatDateTime(dock.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(dock.updatedAt)} />
        </dl>
        <Separator className="my-6" />
        <section aria-labelledby="dock-lifecycle-heading" className="flex flex-col gap-3">
          <h3 className="font-medium" id="dock-lifecycle-heading">
            Lifecycle
          </h3>
          <dl className="grid gap-4 text-sm">
            <ResourceDetailField
              label="Archived"
              value={dock.archivedAt ? formatDateTime(dock.archivedAt) : null}
            />
            <ResourceDetailField label="Archive comment" value={dock.archiveComment} />
            <ResourceDetailField
              label="Reactivated"
              value={dock.reactivatedAt ? formatDateTime(dock.reactivatedAt) : null}
            />
            <ResourceDetailField label="Reactivation comment" value={dock.reactivationComment} />
          </dl>
        </section>
      </ResourceDetailBody>
      {canEdit && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          {dock.status === 'AVAILABLE' && <Button onClick={onEdit}>Edit dock</Button>}
          <DockLifecycleActions dock={dock} />
        </SheetFooter>
      )}
    </div>
  )
}
