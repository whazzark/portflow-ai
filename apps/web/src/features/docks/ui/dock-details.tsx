import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import {
  ResourceDetailBody,
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
import { DockLifecycleActions, dockLifecycleBlocks } from '@/features/docks/dock-lifecycle'
import type { DockDto } from '@/features/docks/types'
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
  const lifecycleBlocks = dockLifecycleBlocks(dock)

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
        {lifecycleBlocks.some((block) => block.at) && <Separator className="my-6" />}
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
      </ResourceDetailBody>
      {canEdit && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          {dock.status === 'AVAILABLE' && <Button onClick={onEdit}>Edit</Button>}
          <DockLifecycleActions dock={dock} />
        </SheetFooter>
      )}
    </div>
  )
}
