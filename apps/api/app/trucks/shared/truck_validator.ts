import vine from '@vinejs/vine'

import { lifecycleComment, lifecycleIds, nonBlank } from '#shared/validators/lifecycle_validator'

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

const registrationField = () => vine.string().use(nonBlank()).minLength(1).maxLength(255)
const vehicleModelField = () => vine.string().use(nonBlank()).minLength(1).maxLength(255)
const capacityTonnesField = () =>
  vine
    .number()
    .range([MIN_CAPACITY_TONNES, MAX_CAPACITY_TONNES])
    .use(maxDecimalPlaces({ max: 3 }))
const transportCompanyIdField = () => vine.string().uuid()

export const createTruckValidator = vine.create({
  registration: registrationField(),
  vehicleModel: vehicleModelField().nullable().optional(),
  capacityTonnes: capacityTonnesField(),
  transportCompanyId: transportCompanyIdField(),
})

/**
 * `vehicleModel` is nullable but not optional: an omitted key must fail validation rather than
 * silently clearing the stored value, so clearing it always requires an explicit `null`.
 */
export const updateTruckValidator = vine.create({
  registration: registrationField(),
  vehicleModel: vehicleModelField().nullable(),
  capacityTonnes: capacityTonnesField(),
  transportCompanyId: transportCompanyIdField(),
})

export const archiveTruckValidator = vine.create({
  comment: lifecycleComment(),
})

export const archiveTrucksValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})

export const reactivateTruckValidator = vine.create({
  comment: lifecycleComment(),
})

export const reactivateTrucksValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})
