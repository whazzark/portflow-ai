import { toast } from 'sonner'
import { z } from 'zod'

import { FieldGroup } from '@/components/ui/field'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

/** Mirrors the API bounds for the NUMERIC(12, 3) `trucks.capacity_tonnes` column. */
const MIN_CAPACITY_TONNES = 0.001
const MAX_CAPACITY_TONNES = 999_999_999.999
/** Plain decimal notation only: exponent forms such as `1e-7` would slip past the checks below. */
const CAPACITY_PATTERN = /^\d*\.?\d+$/

const truckSchema = z.object({
  registration: z.string().trim().min(1, 'Registration is required.').max(255),
  vehicleModel: z.string().trim().max(255),
  capacityTonnes: z
    .string()
    .trim()
    .min(1, 'Capacity is required.')
    .refine((value) => CAPACITY_PATTERN.test(value) && Number(value) >= MIN_CAPACITY_TONNES, {
      message: 'Capacity must be a positive number of tonnes.',
    })
    .refine((value) => !CAPACITY_PATTERN.test(value) || Number(value) <= MAX_CAPACITY_TONNES, {
      message: `Capacity must not exceed ${MAX_CAPACITY_TONNES} tonnes.`,
    })
    .refine(
      (value) => {
        const [, fraction] = value.split('.')
        return !fraction || fraction.length <= 3
      },
      { message: 'Capacity must not have more than 3 decimal places.' },
    ),
  transportCompanyId: z.string().min(1, 'Select a transport company.'),
})

export type CreateTruckValue = {
  registration: string
  vehicleModel: string | null
  capacityTonnes: number
  transportCompanyId: string
}

type TruckFormProps = {
  companies: Array<Pick<TransportCompanyDto, 'id' | 'name'>>
  onCreate: (value: CreateTruckValue) => Promise<TruckDto>
  onSuccess: (truck: TruckDto) => void
}

export function TruckForm({ companies, onCreate, onSuccess }: TruckFormProps) {
  const form = useAppForm({
    defaultValues: {
      registration: '',
      vehicleModel: '',
      capacityTonnes: '',
      transportCompanyId: '',
    },
    validators: {
      onBlur: truckSchema,
      onSubmit: truckSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        const trimmedVehicleModel = value.vehicleModel.trim()
        const created = await onCreate({
          registration: value.registration.trim(),
          vehicleModel: trimmedVehicleModel ? trimmedVehicleModel : null,
          capacityTonnes: Number(value.capacityTonnes),
          transportCompanyId: value.transportCompanyId,
        })

        onSuccess(created)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          toast.error('Unable to create truck', { description: apiError.message })
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="registration">
            {(field) => (
              <field.TextField
                autoComplete="off"
                label="Registration"
                placeholder="AB-123-CD"
                required={true}
              />
            )}
          </form.AppField>
          <form.AppField name="capacityTonnes">
            {(field) => (
              <field.TextField
                autoComplete="off"
                inputMode="decimal"
                label="Capacity (tonnes)"
                placeholder="32.5"
                required={true}
              />
            )}
          </form.AppField>
          <form.AppField name="vehicleModel">
            {(field) => (
              <field.TextField autoComplete="off" label="Vehicle model" placeholder="Volvo FMX" />
            )}
          </form.AppField>
          <form.AppField name="transportCompanyId">
            {(field) => (
              <field.SelectField
                label="Transport company"
                options={companies.map((company) => ({ label: company.name, value: company.id }))}
                placeholder="Select a transport company"
                required={true}
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton pendingLabel="Saving…">Create truck</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
