import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { DockDto } from '@/features/docks/types'
import { DockForm, type PendingDockPlacement } from '@/features/docks/ui/dock-form'

export function CreateDockPanel({
  pending,
  onPendingChange,
  onCreate,
  onSuccess,
}: {
  pending: PendingDockPlacement | null
  onPendingChange: (point: PendingDockPlacement) => void
  onCreate: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onSuccess: (dock: DockDto) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create dock</SheetTitle>
        <SheetDescription>
          Click a point on the map to place the new dock, then name it.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <DockForm
          onCreate={onCreate}
          onPendingChange={onPendingChange}
          onSuccess={onSuccess}
          pending={pending}
        />
      </div>
    </div>
  )
}
