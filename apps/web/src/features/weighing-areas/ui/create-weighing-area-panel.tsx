import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import {
  type PendingWeighingAreaPlacement,
  WeighingAreaForm,
} from '@/features/weighing-areas/ui/weighing-area-form'

export function CreateWeighingAreaPanel({
  pending,
  onPendingChange,
  onCreate,
  onSuccess,
}: {
  pending: PendingWeighingAreaPlacement | null
  onPendingChange: (point: PendingWeighingAreaPlacement) => void
  onCreate: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<WeighingAreaDto>
  onSuccess: (area: WeighingAreaDto) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create weighing area</SheetTitle>
        <SheetDescription>
          Click a point on the map to place the new weighing area, then name it.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <WeighingAreaForm
          errorTitle="Unable to create weighing area"
          initialValues={null}
          onPendingChange={onPendingChange}
          onSubmit={onCreate}
          onSuccess={onSuccess}
          pending={pending}
          pendingLabel="Creating…"
          submitLabel="Create weighing area"
        />
      </div>
    </div>
  )
}
