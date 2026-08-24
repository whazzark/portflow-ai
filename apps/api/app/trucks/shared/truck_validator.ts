import vine from '@vinejs/vine'

import { nonBlank } from '#site_references/shared/site_reference_validator'

/**
 * `trucks.capacity_tonnes` is a NUMERIC(12, 3) column guarded by a `capacity_tonnes > 0` check,
 * so anything outside this range has to be rejected here rather than by the database.
 */
const MIN_CAPACITY_TONNES = 0.001
const MAX_CAPACITY_TONNES = 999_999_999.999

const decimalPlaces = (value: number) => {
  const [mantissa, exponent] = value.toString().split(/e/i)
  const [, fraction = ''] = mantissa.split('.')

  if (exponent === undefined) {
    return fraction.length
  }

  return Math.max(0, fraction.length - Number(exponent))
}

const maxDecimalPlaces = vine.createRule((value: unknown, options: { max: number }, field) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return
  }

  if (decimalPlaces(value) > options.max) {
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
    .range([MIN_CAPACITY_TONNES, MAX_CAPACITY_TONNES])
    .use(maxDecimalPlaces({ max: 3 })),
  transportCompanyId: vine.string().uuid(),
})
