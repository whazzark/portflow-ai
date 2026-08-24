import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import {
  type PendingWeighingAreaPlacement,
  WeighingAreaForm,
} from '@/features/weighing-areas/ui/weighing-area-form'

export function EditWeighingAreaPanel({
  area,
  draft,
  origin,
  onDraftChange,
  onRestorePosition,
  onCancel,
  onNotFound,
  onUpdate,
  onSuccess,
}: {
  area: WeighingAreaDto
  draft: PendingWeighingAreaPlacement
  /** Where the area stood when this edit session started — not its live, refetchable position. */
  origin: PendingWeighingAreaPlacement
  onDraftChange: (point: PendingWeighingAreaPlacement) => void
  onRestorePosition: () => void
  onCancel: () => void
  onNotFound: () => void
  onUpdate: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<WeighingAreaDto>
  onSuccess: (area: WeighingAreaDto) => void
}) {
  const positionModified =
    draft.latitude !== origin.latitude || draft.longitude !== origin.longitude

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to weighing area details
        </Button>
        <SheetTitle>Edit weighing area</SheetTitle>
        <SheetDescription>
          Drag the marker or edit its coordinates to reposition {area.name}.
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
        <WeighingAreaForm
          errorTitle="Unable to update weighing area"
          initialValues={{ name: area.name, latitude: area.latitude, longitude: area.longitude }}
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
