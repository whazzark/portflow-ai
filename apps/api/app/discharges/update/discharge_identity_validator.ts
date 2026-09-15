import vine from '@vinejs/vine'

import { instant } from '#shared/validators/instant_validator'
import { nonBlank } from '#shared/validators/lifecycle_validator'

/**
 * The identity fields a discharge is created with and corrected through. The nullable fields are
 * not optional: an omitted key fails rather than silently clearing the stored value, so clearing
 * one always takes an explicit `null`. A blank IMO or comment passes here and becomes `null` in the
 * use case, which owns normalization.
 */
export const dischargeIdentityFields = () => ({
  vesselName: vine.string().use(nonBlank()).maxLength(255),
  vesselImo: vine
    .string()
    .regex(/^\s*(\d{7})?\s*$/)
    .nullable(),
  vesselComment: vine.string().maxLength(2000).nullable(),
  dockId: vine.string().uuid(),
  expectedStartAt: instant(),
})

export const correctDischargeIdentityValidator = vine.create(dischargeIdentityFields())
