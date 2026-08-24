import { toast } from 'sonner'
import { z } from 'zod'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  CoordinateField,
  useCoordinateFields,
} from '@/components/resource-map/resource-placement-fields'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import type { DockDto } from '@/features/docks/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export type PendingDockPlacement = LatLng

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Dock name is required.').max(255),
})

export function DockForm({
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

          if (apiError.code === 'E_DOCK_NAME_CONFLICT') {
            formApi.setErrorMap({
              onSubmit: { fields: { name: apiError.message }, form: '' },
            })
          } else {
            toast.error('Unable to create dock', { description: apiError.message })
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
                label="Dock name"
                placeholder="North Dock"
                required={true}
              />
            )}
          </form.AppField>
          <FieldDescription role="status">
            Click the map to place the new dock, or enter its coordinates directly.
          </FieldDescription>
          <CoordinateField
            axis="latitude"
            error={coordinateFields.latitude.error}
            idPrefix="dock"
            onChange={coordinateFields.latitude.onChange}
            text={coordinateFields.latitude.text}
          />
          <CoordinateField
            axis="longitude"
            error={coordinateFields.longitude.error}
            idPrefix="dock"
            onChange={coordinateFields.longitude.onChange}
            text={coordinateFields.longitude.text}
          />
          {!pending && (
            <FieldDescription role="status">
              A location must be placed before this dock can be created.
            </FieldDescription>
          )}
        </FieldGroup>
        <form.FormError />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {isSubmitting ? 'Creating…' : 'Create dock'}
            </Button>
          )}
        </form.Subscribe>
      </form.Form>
    </form.AppForm>
  )
}
