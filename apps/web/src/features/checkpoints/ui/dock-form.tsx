import { toast } from 'sonner'
import { z } from 'zod'
import { FieldGroup } from '@/components/ui/field'
import type { DockDto } from '@/features/checkpoints/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const dockSchema = z.object({
  name: z.string().trim().min(1, 'Dock name is required.').max(255),
  latitude: z
    .string()
    .trim()
    .refine((value) => value !== '' && Number.isFinite(Number(value)), {
      message: 'Latitude is required.',
    }),
  longitude: z
    .string()
    .trim()
    .refine((value) => value !== '' && Number.isFinite(Number(value)), {
      message: 'Longitude is required.',
    }),
})

type DockFormProps = {
  dock?: DockDto
  onCreate: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onUpdate: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onSuccess: (dock: DockDto) => void
}

export function DockForm({ dock, onCreate, onUpdate, onSuccess }: DockFormProps) {
  const form = useAppForm({
    defaultValues: {
      name: dock?.name ?? '',
      latitude: dock?.latitude.toString() ?? '',
      longitude: dock?.longitude.toString() ?? '',
    },
    validators: { onBlur: dockSchema, onSubmit: dockSchema },
    onSubmit: async ({ formApi, value }) => {
      try {
        const payload = {
          name: value.name.trim(),
          latitude: Number(value.latitude),
          longitude: Number(value.longitude),
        }
        const result = dock ? await onUpdate(payload) : await onCreate(payload)
        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)
          toast.error(dock ? 'Unable to update dock' : 'Unable to create dock', {
            description: apiError.message,
          })
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
              <field.TextField label="Dock name" placeholder="North Dock" required={true} />
            )}
          </form.AppField>
          <form.AppField name="latitude">
            {(field) => (
              <field.TextField
                description="Between -90 and 90."
                inputMode="decimal"
                label="Latitude"
                placeholder="48.8566"
                required={true}
              />
            )}
          </form.AppField>
          <form.AppField name="longitude">
            {(field) => (
              <field.TextField
                description="Between -180 and 180."
                inputMode="decimal"
                label="Longitude"
                placeholder="2.3522"
                required={true}
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton pendingLabel="Saving…">
          {dock ? 'Save dock changes' : 'Create dock'}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
