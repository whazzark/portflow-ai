import vine from '@vinejs/vine'

import { nonBlank } from '#shared/validators/lifecycle_validator'
import { tonnageString } from '#shared/validators/tonnage_validator'

/**
 * One product lot, as creation lists them and as a lot is added or corrected. The description is
 * nullable but not optional, for the same reason as the discharge identity fields.
 */
export const productLotFields = () => ({
  customerId: vine.string().uuid(),
  productName: vine.string().use(nonBlank()).maxLength(255),
  expectedQuantityTonnes: tonnageString(),
  description: vine.string().maxLength(2000).nullable(),
})

export const productLotValidator = vine.create(productLotFields())
