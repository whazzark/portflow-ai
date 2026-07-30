import { toast } from 'sonner'
import { z } from 'zod'
import { FieldGroup } from '@/components/ui/field'
import type { WeighingAreaDto } from '@/features/checkpoints/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const weighingAreaSchema = z.object({
  name: z.string().trim().min(1, 'Weighing area name is required.').max(255),
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

type WeighingAreaFormProps = {
  area?: WeighingAreaDto
  onCreate: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<WeighingAreaDto>
  onUpdate: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<WeighingAreaDto>
  onSuccess: (area: WeighingAreaDto) => void
}

export function WeighingAreaForm({ area, onCreate, onUpdate, onSuccess }: WeighingAreaFormProps) {
  const form = useAppForm({
    defaultValues: {
      name: area?.name ?? '',
      latitude: area?.latitude.toString() ?? '',
      longitude: area?.longitude.toString() ?? '',
    },
    validators: { onBlur: weighingAreaSchema, onSubmit: weighingAreaSchema },
    onSubmit: async ({ formApi, value }) => {
      try {
        const payload = {
          name: value.name.trim(),
          latitude: Number(value.latitude),
          longitude: Number(value.longitude),
        }
        const result = area ? await onUpdate(payload) : await onCreate(payload)
        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)
          toast.error(area ? 'Unable to update weighing area' : 'Unable to create weighing area', {
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
              <field.TextField
                label="Weighing area name"
                placeholder="North Scale"
                required={true}
              />
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
          {area ? 'Save weighing area changes' : 'Create weighing area'}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
