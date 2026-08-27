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
import { DOOR_SINGULAR } from '@/features/warehouse-doors/warehouse-door-presentation'
import { isInsideFootprint } from '@/features/warehouses/geometry/footprint-validation'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { resourceFailureTitle } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const OUTSIDE_FOOTPRINT_MESSAGE =
  'Place the door inside its warehouse footprint, or on its boundary.'

const PLACEMENT_REQUIRED_MESSAGE = 'Click the map inside the warehouse to place the door.'

export type CreatedWarehouseDoor = { id: string; name: string }

export function CreateWarehouseDoorPanel({
  warehouse,
  pending,
  onPendingChange,
  onCancel,
  onCreate,
  onSuccess,
}: {
  warehouse: WarehouseWithDoorsDto
  pending: LatLng | null
  onPendingChange: (point: LatLng) => void
  onCancel: () => void
  onCreate: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<CreatedWarehouseDoor>
  onSuccess: (door: CreatedWarehouseDoor) => void
}) {
  const coordinateFields = useCoordinateFields(pending, onPendingChange)
  const hasCoordinateError = Boolean(
    coordinateFields.latitude.error || coordinateFields.longitude.error,
  )
  // Feedback only: the API re-checks containment against the footprint it reads under lock, which
  // is the authoritative one. This copy just spares the administrator a round-trip.
  const isOutsideFootprint =
    pending !== null && !isInsideFootprint(warehouse.footprint.points, pending)
  const canSubmit = pending !== null && !hasCoordinateError && !isOutsideFootprint

  const nameSchema = z.object({
    name: z.string().trim().min(1, 'Door name is required.').max(255),
  })

  const form = useAppForm({
    defaultValues: { name: '' },
    validators: { onBlur: nameSchema, onSubmit: nameSchema },
    onSubmit: async ({ formApi, value }) => {
      if (pending === null) {
        formApi.setErrorMap({ onSubmit: { fields: {}, form: PLACEMENT_REQUIRED_MESSAGE } })
        return
      }

      if (!canSubmit) {
        return
      }

      try {
        onSuccess(
          await onCreate({
            name: value.name.trim(),
            latitude: pending.latitude,
            longitude: pending.longitude,
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
          apiError.code === 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT' ||
          apiError.code === 'E_WAREHOUSE_DOOR_COORDINATES_INVALID' ||
          apiError.code === 'E_WAREHOUSE_ARCHIVED' ||
          apiError.code === 'E_WAREHOUSE_NOT_FOUND'
        ) {
          formApi.setErrorMap({ onSubmit: { fields: {}, form: apiError.message } })
        } else {
          // Neither the typed name nor the pending marker is cleared, so a retry after a transient
          // failure re-sends the same submission rather than starting over.
          toast.error(resourceFailureTitle('create', DOOR_SINGULAR, value.name.trim()), {
            description: apiError.message,
          })
        }
      }
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create door</SheetTitle>
        <SheetDescription>
          Click a point inside {warehouse.name} to place the new door, then name it.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-4">
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
              {/* Drawing on the map is the expected path, but the coordinates are never hidden:
                  they are the only way to place a door without a pointing device. */}
              <CoordinateField
                axis="latitude"
                error={coordinateFields.latitude.error}
                idPrefix="warehouse-door"
                onChange={coordinateFields.latitude.onChange}
                text={coordinateFields.latitude.text}
              />
              <CoordinateField
                axis="longitude"
                error={coordinateFields.longitude.error}
                idPrefix="warehouse-door"
                onChange={coordinateFields.longitude.onChange}
                text={coordinateFields.longitude.text}
              />
              {pending === null && (
                <FieldDescription role="status">{PLACEMENT_REQUIRED_MESSAGE}</FieldDescription>
              )}
              {isOutsideFootprint && (
                <FieldDescription role="status">{OUTSIDE_FOOTPRINT_MESSAGE}</FieldDescription>
              )}
            </FieldGroup>
            <form.FormError />
            <div className="flex gap-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button disabled={isSubmitting || !canSubmit} type="submit">
                    {isSubmitting ? 'Creating…' : 'Create door'}
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
