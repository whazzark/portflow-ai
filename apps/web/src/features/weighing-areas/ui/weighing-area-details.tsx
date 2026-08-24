import {
  ResourceDetailBody,
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource-map/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { formatDateTime } from '@/helpers/dates'

export function WeighingAreaDetails({
  canEdit,
  area,
  onEdit,
}: {
  canEdit: boolean
  area: WeighingAreaDto
  onEdit: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceDetailHeader
        archivedMessage="Archived weighing areas cannot receive new operations."
        name={area.name}
        status={area.status}
      />
      <ResourceDetailBody>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <ResourceDetailField label="Latitude" value={String(area.latitude)} />
          <ResourceDetailField label="Longitude" value={String(area.longitude)} />
          <ResourceDetailField label="Created" value={formatDateTime(area.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(area.updatedAt)} />
        </dl>
        <Separator className="my-6" />
        <section aria-labelledby="weighing-area-lifecycle-heading" className="flex flex-col gap-3">
          <h3 className="font-medium" id="weighing-area-lifecycle-heading">
            Lifecycle
          </h3>
          <dl className="grid gap-4 text-sm">
            <ResourceDetailField
              label="Archived"
              value={area.archivedAt ? formatDateTime(area.archivedAt) : null}
            />
            <ResourceDetailField label="Archive comment" value={area.archiveComment} />
            <ResourceDetailField
              label="Reactivated"
              value={area.reactivatedAt ? formatDateTime(area.reactivatedAt) : null}
            />
            <ResourceDetailField label="Reactivation comment" value={area.reactivationComment} />
          </dl>
        </section>
      </ResourceDetailBody>
      {canEdit && area.status === 'AVAILABLE' && (
        <SheetFooter className="shrink-0 border-t bg-popover">
          <Button onClick={onEdit}>Edit weighing area</Button>
        </SheetFooter>
      )}
    </div>
  )
}
