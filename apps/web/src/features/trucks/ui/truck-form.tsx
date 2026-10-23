import { z } from 'zod'

import type { TruckDto } from '@/features/trucks/types'
import { applyRefusal, type RefusalPlacement } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'

/** Mirrors the API bounds for the NUMERIC(12, 3) `trucks.capacity_tonnes` column. */
const MIN_CAPACITY_TONNES = 0.001
const MAX_CAPACITY_TONNES = 999_999_999.999
/** Plain decimal notation only: exponent forms such as `1e-7` would slip past the checks below. */
const CAPACITY_PATTERN = /^\d*\.?\d+$/

export const truckFormSchema = z.object({
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

export type TruckFormValue = {
  registration: string
  vehicleModel: string | null
  capacityTonnes: number
  transportCompanyId: string
}

/** The refusals an administrator can act on from the field they concern. */
const TRUCK_REFUSALS: Record<string, RefusalPlacement> = {
  E_TRUCK_REGISTRATION_CONFLICT: { field: 'registration' },
  E_TRUCK_TRANSPORT_COMPANY_INVALID: { field: 'transportCompanyId' },
  E_TRUCK_TRANSPORT_COMPANY_LOCKED: {
    field: 'transportCompanyId',
    message: 'The company cannot change while this truck is used by a planned or active discharge.',
  },
}

/**
 * A truck's creation or correction form. Every refusal stays in the form, beside what was typed:
 * validation details and the refusals above on their fields, anything else at form level.
 */
export function useTruckForm({
  truck,
  transportCompanyId,
  onSubmit,
  onSuccess,
}: {
  truck?: TruckDto
  /** The company a new truck joins, when it is not chosen in the form. */
  transportCompanyId?: string
  onSubmit: (value: TruckFormValue) => Promise<TruckDto>
  onSuccess: (truck: TruckDto) => void
}) {
  return useAppForm({
    defaultValues: {
      registration: truck?.registration ?? '',
      vehicleModel: truck?.vehicleModel ?? '',
      capacityTonnes: truck ? String(truck.capacityTonnes) : '',
      transportCompanyId: truck?.transportCompanyId ?? transportCompanyId ?? '',
    },
    validators: {
      onBlur: truckFormSchema,
      onSubmit: truckFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      const vehicleModel = value.vehicleModel.trim()

      try {
        onSuccess(
          await onSubmit({
            registration: value.registration.trim(),
            vehicleModel: vehicleModel ? vehicleModel : null,
            capacityTonnes: Number(value.capacityTonnes),
            transportCompanyId: value.transportCompanyId,
          }),
        )
      } catch (error) {
        applyRefusal(formApi, error, TRUCK_REFUSALS)
      }
    },
  })
}
