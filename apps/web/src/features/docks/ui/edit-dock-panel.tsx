import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { DockDto } from '@/features/docks/types'
import { DockForm, type PendingDockPlacement } from '@/features/docks/ui/dock-form'

export function EditDockPanel({
  dock,
  draft,
  origin,
  onDraftChange,
  onRestorePosition,
  onCancel,
  onNotFound,
  onUpdate,
  onSuccess,
}: {
  dock: DockDto
  draft: PendingDockPlacement
  /** Where the dock stood when this edit session started — not its live, refetchable position. */
  origin: PendingDockPlacement
  onDraftChange: (point: PendingDockPlacement) => void
  onRestorePosition: () => void
  onCancel: () => void
  onNotFound: () => void
  onUpdate: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onSuccess: (dock: DockDto) => void
}) {
  const positionModified =
    draft.latitude !== origin.latitude || draft.longitude !== origin.longitude

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to dock details
        </Button>
        <SheetTitle>Edit dock</SheetTitle>
        <SheetDescription>
          Drag the marker or edit its coordinates to reposition {dock.name}.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        {positionModified && (
          <FieldDescription className="mb-4 flex items-center justify-between gap-2" role="status">
            <span>Position modified</span>
            <Button onClick={onRestorePosition} size="sm" type="button" variant="link">
              Restore original position
            </Button>
          </FieldDescription>
        )}
        <DockForm
          errorTitle="Unable to update dock"
          initialValues={{ name: dock.name, latitude: dock.latitude, longitude: dock.longitude }}
          onNotFound={onNotFound}
          onPendingChange={onDraftChange}
          onSubmit={onUpdate}
          onSuccess={onSuccess}
          pending={draft}
          pendingLabel="Saving…"
          submitLabel="Save changes"
        />
      </div>
    </div>
  )
}
