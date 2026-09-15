import vine from '@vinejs/vine'

import { distinctUuids } from '#shared/validators/lifecycle_validator'

/**
 * One truck sent in two casings is a duplicate like any other, and a duplicate is refused rather
 * than merged: it can only come from a client bug. The upper bound covers every truck of a large
 * site with headroom (research.md Decision 7).
 */
const truckIds = () =>
  vine.array(vine.string().uuid().toLowerCase()).maxLength(500).use(distinctUuids())

/** The trucks to reserve for, or withdraw from, a planned discharge's pool. */
export const truckIdsValidator = vine.create({ truckIds: truckIds().minLength(1) })

/** The complete selection wanted for a planned shift; an empty one clears it. */
export const shiftTruckSelectionValidator = vine.create({ truckIds: truckIds() })
