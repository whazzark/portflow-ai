import { DateTime } from 'luxon'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { ShiftWeighingAreaFactory } from '#database/factories/shift_resource_membership_factories'
import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import type { DischargeStatus } from '#models/discharge'

type PersistedWeighingAreaUsageScenarioOptions = {
  status?: DischargeStatus
  weighingAreaEnded?: boolean
}

export async function createPersistedWeighingAreaUsageScenario({
  status = 'PLANNED' as DischargeStatus,
  weighingAreaEnded = false,
}: PersistedWeighingAreaUsageScenarioOptions = {}) {
  const [dock, weighingArea, user] = await Promise.all([
    DockFactory.create(),
    WeighingAreaFactory.create(),
    UserFactory.apply('active').create(),
  ])
  const discharge = await DischargeFactory.merge({ dockId: dock.id, status }).create()
  const shift = await ShiftFactory.merge({
    dischargeId: discharge.id,
    responsibleUserId: user.id,
  }).create()
  const effectiveFrom = DateTime.now().minus({ hours: 2 })
  const effectiveTo = effectiveFrom.plus({ hours: 1 })
  const weighingAreaMembership = await ShiftWeighingAreaFactory.merge({
    shiftId: shift.id,
    weighingAreaId: weighingArea.id,
    effectiveFrom,
    effectiveTo: weighingAreaEnded ? effectiveTo : null,
  }).create()

  return { dock, weighingArea, user, discharge, shift, weighingAreaMembership }
}
