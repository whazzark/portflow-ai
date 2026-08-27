import { toast } from 'sonner'
import { z } from 'zod'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  CoordinateField,
  useCoordinateFields,
} from '@/components/resource-map/resource-placement-fields'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import {
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_PARAM_BY_KIND,
  type CheckpointKind,
} from '@/features/checkpoints/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export type PendingCheckpointPlacement = LatLng

const NAME_PLACEHOLDER_BY_KIND: Record<CheckpointKind, string> = {
  DOCK: 'North Dock',
  WEIGHING_AREA: 'North Scale',
}

/** Every checkpoint kind's API errors follow `E_<KIND>_<REASON>`, keyed the same way as
 * `CheckpointKind` itself (e.g. `E_DOCK_ARCHIVED`, `E_WEIGHING_AREA_ARCHIVED`). */
const ERROR_CODE = {
  nameConflict: (kind: CheckpointKind) => `E_${kind}_NAME_CONFLICT`,
  archived: (kind: CheckpointKind) => `E_${kind}_ARCHIVED`,
  notFound: (kind: CheckpointKind) => `E_${kind}_NOT_FOUND`,
}

export function CheckpointResourceForm<TResource>({
  kind,
  initialValues = null,
  pending,
  onPendingChange,
  onSubmit,
  onSuccess,
  onNotFound,
  submitLabel,
  pendingLabel,
  failureTitle,
}: {
  kind: CheckpointKind
  initialValues?: { name: string; latitude: number; longitude: number } | null
  pending: PendingCheckpointPlacement | null
  onPendingChange: (point: PendingCheckpointPlacement) => void
  onSubmit: (value: { name: string; latitude: number; longitude: number }) => Promise<TResource>
  onSuccess: (resource: TResource) => void
  /** Update-only: called when the server reports the resource no longer exists. */
  onNotFound?: () => void
  submitLabel: string
  pendingLabel: string
  /** Built from the submitted name, because a creation has no stored one to quote. An update
   * ignores it and names the checkpoint as it stands. */
  failureTitle: (submittedName: string) => string
}) {
  const isEditing = initialValues !== null
  const resourceNoun = CHECKPOINT_KIND_LABELS[kind].toLowerCase()
  const idPrefix = CHECKPOINT_PARAM_BY_KIND[kind]
  const coordinateFields = useCoordinateFields(pending, onPendingChange)
  const hasCoordinateError = Boolean(
    coordinateFields.latitude.error || coordinateFields.longitude.error,
  )
  const canSubmit = (isEditing || Boolean(pending)) && !hasCoordinateError
  const nameSchema = z.object({
    name: z.string().trim().min(1, `${CHECKPOINT_KIND_LABELS[kind]} name is required.`).max(255),
  })

  const form = useAppForm({
    defaultValues: { name: initialValues?.name ?? '' },
    validators: {
      onBlur: nameSchema,
      onSubmit: nameSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      if (!pending || hasCoordinateError) {
        return
      }

      const submittedName = value.name.trim()

      try {
        const result = await onSubmit({
          name: submittedName,
          latitude: pending.latitude,
          longitude: pending.longitude,
        })

        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          if (apiError.code === ERROR_CODE.nameConflict(kind)) {
            formApi.setErrorMap({
              onSubmit: { fields: { name: apiError.message }, form: '' },
            })
          } else if (apiError.code === ERROR_CODE.archived(kind)) {
            formApi.setErrorMap({
              onSubmit: {
                fields: {},
                form: `${apiError.message}. Reactivate the ${resourceNoun} before editing it.`,
              },
            })
          } else if (apiError.code === ERROR_CODE.notFound(kind) && onNotFound) {
            toast.error(failureTitle(submittedName), { description: apiError.message })
            onNotFound()
          } else {
            toast.error(failureTitle(submittedName), { description: apiError.message })
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
                autoFocus={isEditing}
                label={`${CHECKPOINT_KIND_LABELS[kind]} name`}
                placeholder={NAME_PLACEHOLDER_BY_KIND[kind]}
                required={true}
              />
            )}
          </form.AppField>
          {!isEditing && (
            <FieldDescription role="status">
              Click the map to place the new {resourceNoun}, or enter its coordinates directly.
            </FieldDescription>
          )}
          <CoordinateField
            axis="latitude"
            error={coordinateFields.latitude.error}
            idPrefix={idPrefix}
            onChange={coordinateFields.latitude.onChange}
            text={coordinateFields.latitude.text}
          />
          <CoordinateField
            axis="longitude"
            error={coordinateFields.longitude.error}
            idPrefix={idPrefix}
            onChange={coordinateFields.longitude.onChange}
            text={coordinateFields.longitude.text}
          />
          {!isEditing && !pending && (
            <FieldDescription role="status">
              A location must be placed before this {resourceNoun} can be created.
            </FieldDescription>
          )}
        </FieldGroup>
        <form.FormError />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting || !canSubmit} type="submit">
              {isSubmitting ? pendingLabel : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </form.Form>
    </form.AppForm>
  )
}
