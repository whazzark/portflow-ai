import vine from '@vinejs/vine'

import { nonBlank } from '#site_references/shared/site_reference_validator'

const maxDecimalPlaces = vine.createRule((value: unknown, options: { max: number }, field) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return
  }

  const [, fraction] = value.toString().split('.')
  if (fraction && fraction.length > options.max) {
    field.report(
      `The {{ field }} field must not have more than ${options.max} decimal places`,
      'maxDecimalPlaces',
      field,
    )
  }
})

export const createTruckValidator = vine.create({
  registration: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  vehicleModel: vine.string().use(nonBlank()).minLength(1).maxLength(255).nullable().optional(),
  capacityTonnes: vine
    .number()
    .positive()
    .use(maxDecimalPlaces({ max: 3 })),
  transportCompanyId: vine.string().uuid(),
})
