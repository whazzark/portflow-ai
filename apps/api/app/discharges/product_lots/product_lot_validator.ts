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

/** The lots added to a planned discharge at once: all of them are written, or none. */
export const addProductLotsValidator = vine.create({
  productLots: vine.array(vine.object(productLotFields())).minLength(1).maxLength(100),
})

const { customerId: _customerId, ...lotValueFields } = productLotFields()

/**
 * One customer's lots corrected, added, and removed at once, and the customer they all belong to
 * afterwards. An entry with an id corrects that lot; an entry without one adds a lot.
 */
export const customerProductLotsCorrectionValidator = vine.create({
  customerId: vine.string().uuid(),
  productLots: vine
    .array(vine.object({ id: vine.string().uuid().optional(), ...lotValueFields }))
    .maxLength(100),
  removedProductLotIds: vine.array(vine.string().uuid()).maxLength(100),
})
