import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  CoordinateField,
  useCoordinateFields,
} from '@/components/resource-map/resource-placement-fields'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import { isInsideFootprint } from '@/features/warehouses/geometry/footprint-validation'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const ERROR_TITLE = 'Unable to update door'

const OUTSIDE_FOOTPRINT_MESSAGE =
  'Keep the door inside its warehouse footprint, or on its boundary.'

export type UpdatedWarehouseDoor = { id: string; name: string }

export function EditWarehouseDoorPanel({
  warehouse,
  door,
  draft,
  origin,
  originName,
  onDraftChange,
  onRestorePosition,
  onCancel,
  onNotFound,
  onUpdate,
  onSuccess,
}: {
  warehouse: WarehouseWithDoorsDto
  door: WarehouseDoorDto
  draft: LatLng
  /** Where the door stood when this session started — not its live, refetchable position. */
  origin: LatLng
  /** What the door was called when this session started. */
  originName: string
  onDraftChange: (point: LatLng) => void
  onRestorePosition: () => void
  onCancel: () => void
  onNotFound: () => void
  onUpdate: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<UpdatedWarehouseDoor>
  onSuccess: (door: UpdatedWarehouseDoor) => void
}) {
  const coordinateFields = useCoordinateFields(draft, onDraftChange)
  const hasCoordinateError = Boolean(
    coordinateFields.latitude.error || coordinateFields.longitude.error,
  )
  // Feedback only: the API re-checks containment against the footprint it reads under lock, which
  // is the authoritative one. This copy just spares the administrator a round-trip.
  const isOutsideFootprint = !isInsideFootprint(warehouse.footprint.points, draft)
  const positionModified =
    draft.latitude !== origin.latitude || draft.longitude !== origin.longitude
  // A resubmission of the current name and position is a legitimate no-op, so nothing here
  // disables the button on "no change".
  const canSubmit = !hasCoordinateError && !isOutsideFootprint

  const nameSchema = z.object({
    name: z.string().trim().min(1, 'Door name is required.').max(255),
  })

  const form = useAppForm({
    defaultValues: { name: originName },
    validators: { onBlur: nameSchema, onSubmit: nameSchema },
    onSubmit: async ({ formApi, value }) => {
      if (!canSubmit) {
        return
      }

      try {
        onSuccess(
          await onUpdate({
            name: value.name.trim(),
            latitude: draft.latitude,
            longitude: draft.longitude,
          }),
        )
      } catch (error) {
        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)

        if (
          apiError.code === 'E_WAREHOUSE_DOOR_NAME_CONFLICT' ||
          apiError.code === 'E_WAREHOUSE_DOOR_NAME_INVALID'
        ) {
          formApi.setErrorMap({ onSubmit: { fields: { name: apiError.message }, form: '' } })
        } else if (
          apiError.code === 'E_WAREHOUSE_DOOR_NOT_FOUND' ||
          apiError.code === 'E_WAREHOUSE_NOT_FOUND'
        ) {
          // The door the session was opened for is gone: there is nothing left to correct, so the
          // administrator is returned to a consistent view rather than left editing a ghost.
          toast.error(ERROR_TITLE, { description: apiError.message })
          onNotFound()
        } else if (
          apiError.code === 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT' ||
          apiError.code === 'E_WAREHOUSE_DOOR_COORDINATES_INVALID' ||
          apiError.code === 'E_WAREHOUSE_DOOR_ARCHIVED' ||
          apiError.code === 'E_WAREHOUSE_ARCHIVED'
        ) {
          formApi.setErrorMap({ onSubmit: { fields: {}, form: apiError.message } })
        } else {
          // Neither the typed name nor the draft position is cleared, so a retry after a transient
          // failure re-sends the same submission rather than starting over.
          toast.error(ERROR_TITLE, { description: apiError.message })
        }
      }
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle>Edit door</SheetTitle>
        <SheetDescription>
          Drag the marker or edit its coordinates to reposition {door.name} in {warehouse.name}.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-4">
        {positionModified && (
          <FieldDescription className="mb-4 flex items-center justify-between gap-2" role="status">
            <span>Position modified</span>
            <Button onClick={onRestorePosition} size="sm" type="button" variant="link">
              Restore original position
            </Button>
          </FieldDescription>
        )}
        <form.AppForm>
          <form.Form className="flex flex-col gap-6">
            <FieldGroup>
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    autoComplete="off"
                    label="Door name"
                    placeholder="Door 3"
                    required={true}
                  />
                )}
              </form.AppField>
              {/* Dragging the marker is the expected path, but the coordinates are never hidden:
                  they are the only way to reposition a door without a pointing device. */}
              <CoordinateField
                axis="latitude"
                error={coordinateFields.latitude.error}
                idPrefix="warehouse-door-edit"
                onChange={coordinateFields.latitude.onChange}
                text={coordinateFields.latitude.text}
              />
              <CoordinateField
                axis="longitude"
                error={coordinateFields.longitude.error}
                idPrefix="warehouse-door-edit"
                onChange={coordinateFields.longitude.onChange}
                text={coordinateFields.longitude.text}
              />
              {isOutsideFootprint && (
                <FieldDescription role="status">{OUTSIDE_FOOTPRINT_MESSAGE}</FieldDescription>
              )}
            </FieldGroup>
            <form.FormError />
            <div className="flex gap-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button disabled={isSubmitting || !canSubmit} type="submit">
                    {isSubmitting ? 'Saving…' : 'Save changes'}
                  </Button>
                )}
              </form.Subscribe>
              <Button onClick={onCancel} type="button" variant="outline">
                Cancel
              </Button>
            </div>
          </form.Form>
        </form.AppForm>
      </div>
    </div>
  )
}
