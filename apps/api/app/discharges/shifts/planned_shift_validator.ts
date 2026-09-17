import vine from '@vinejs/vine'

import { truckIds } from '#discharges/truck_pool/truck_pool_validators'
import { instant } from '#shared/validators/instant_validator'
import { distinctUuids } from '#shared/validators/lifecycle_validator'

/**
 * A shift's doors or weighing areas, sent complete. The bound is a sanity limit on a request, well
 * above the handful of each a shift works with; it is not a business rule.
 */
const resourceIds = () =>
  vine.array(vine.string().uuid().toLowerCase()).maxLength(100).use(distinctUuids())

/**
 * Everything planned for one shift at once: its period, its responsible, and the complete trucks,
 * warehouse doors, and weighing areas wanted for it. An empty selection clears it.
 */
export const plannedShiftCorrectionValidator = vine.create({
  plannedStartAt: instant(),
  plannedEndAt: instant(),
  responsibleUserId: vine.string().uuid(),
  truckIds: truckIds(),
  warehouseDoorIds: resourceIds(),
  weighingAreaIds: resourceIds(),
})

/**
 * A shift added to a discharge: the identity its form generated, which makes a resubmission find
 * the shift it already added, its period, its responsible, and the resources it starts with. The
 * selections may be left out, as an active discharge's shift is added without any.
 */
export const plannedShiftAdditionValidator = vine.create({
  id: vine.string().uuid().toLowerCase(),
  plannedStartAt: instant(),
  plannedEndAt: instant(),
  responsibleUserId: vine.string().uuid(),
  truckIds: truckIds().optional(),
  warehouseDoorIds: resourceIds().optional(),
  weighingAreaIds: resourceIds().optional(),
})
