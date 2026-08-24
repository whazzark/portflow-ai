import { toast } from 'sonner'
import { z } from 'zod'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  CoordinateField,
  useCoordinateFields,
} from '@/components/resource-map/resource-placement-fields'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export type PendingWeighingAreaPlacement = LatLng

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Weighing area name is required.').max(255),
})

export function WeighingAreaForm({
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
  const coordinateFields = useCoordinateFields(pending, onPendingChange)
  const hasCoordinateError = Boolean(
    coordinateFields.latitude.error || coordinateFields.longitude.error,
  )
  const canSubmit = Boolean(pending) && !hasCoordinateError

  const form = useAppForm({
    defaultValues: { name: '' },
    validators: {
      onBlur: nameSchema,
      onSubmit: nameSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      if (!pending || hasCoordinateError) {
        return
      }

      try {
        const result = await onCreate({
          name: value.name.trim(),
          latitude: pending.latitude,
          longitude: pending.longitude,
        })

        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          if (apiError.code === 'E_WEIGHING_AREA_NAME_CONFLICT') {
            formApi.setErrorMap({
              onSubmit: { fields: { name: apiError.message }, form: '' },
            })
          } else {
            toast.error('Unable to create weighing area', { description: apiError.message })
          }
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                autoComplete="off"
                label="Weighing area name"
                placeholder="North Scale"
                required={true}
              />
            )}
          </form.AppField>
          <FieldDescription role="status">
            Click the map to place the new weighing area, or enter its coordinates directly.
          </FieldDescription>
          <CoordinateField
            axis="latitude"
            error={coordinateFields.latitude.error}
            idPrefix="weighing-area"
            onChange={coordinateFields.latitude.onChange}
            text={coordinateFields.latitude.text}
          />
          <CoordinateField
            axis="longitude"
            error={coordinateFields.longitude.error}
            idPrefix="weighing-area"
            onChange={coordinateFields.longitude.onChange}
            text={coordinateFields.longitude.text}
          />
          {!pending && (
            <FieldDescription role="status">
              A location must be placed before this weighing area can be created.
            </FieldDescription>
          )}
        </FieldGroup>
        <form.FormError />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {isSubmitting ? 'Creating…' : 'Create weighing area'}
            </Button>
          )}
        </form.Subscribe>
      </form.Form>
    </form.AppForm>
  )
}
