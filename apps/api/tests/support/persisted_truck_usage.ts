import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import type { DischargeStatus } from '#models/discharge'

export async function createPersistedTruckUsageScenario({
  status = 'PLANNED' as DischargeStatus,
  released = false,
  transportCompanyId,
}: {
  status?: DischargeStatus
  released?: boolean
  transportCompanyId?: string
} = {}) {
  const [truck, dock] = await Promise.all([
    transportCompanyId
      ? TruckFactory.merge({ transportCompanyId }).create()
      : TruckFactory.create(),
    DockFactory.create(),
  ])
  const discharge = await DischargeFactory.merge({ dockId: dock.id, status }).create()
  const assignmentFactory = released
    ? DischargeTruckAssignmentFactory.apply('released')
    : DischargeTruckAssignmentFactory
  const assignment = await assignmentFactory
    .merge({
      dischargeId: discharge.id,
      truckId: truck.id,
      transportCompanyId: truck.transportCompanyId,
    })
    .create()

  return { truck, dock, discharge, assignment }
}
