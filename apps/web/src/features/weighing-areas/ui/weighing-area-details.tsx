import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import {
  ResourceDetailBody,
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource-map/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import {
  WeighingAreaLifecycleActions,
  weighingAreaLifecycleBlocks,
} from '@/features/weighing-areas/weighing-area-lifecycle'
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
  const lifecycleBlocks = weighingAreaLifecycleBlocks(area)

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
        {lifecycleBlocks.some((block) => block.at) && <Separator className="my-6" />}
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
      </ResourceDetailBody>
      {canEdit && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          {area.status === 'AVAILABLE' && <Button onClick={onEdit}>Edit</Button>}
          <WeighingAreaLifecycleActions area={area} />
        </SheetFooter>
      )}
    </div>
  )
}
