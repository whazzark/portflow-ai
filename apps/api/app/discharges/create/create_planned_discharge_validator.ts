import vine from '@vinejs/vine'

import { productLotFields } from '#discharges/product_lots/product_lot_validator'
import { dischargeIdentityFields } from '#discharges/update/discharge_identity_validator'
import { instant } from '#shared/validators/instant_validator'

/**
 * The bounds on lots and shifts are sanity limits on a request, well above the twenty lots and
 * forty shifts a discharge is expected to hold; they are not business rules.
 */
export const createPlannedDischargeValidator = vine.create({
  id: vine.string().uuid(),
  ...dischargeIdentityFields(),
  productLots: vine.array(vine.object(productLotFields())).minLength(1).maxLength(100),
  shifts: vine
    .array(
      vine.object({
        plannedStartAt: instant(),
        plannedEndAt: instant(),
        responsibleUserId: vine.string().uuid(),
      }),
    )
    .minLength(1)
    .maxLength(100),
})
