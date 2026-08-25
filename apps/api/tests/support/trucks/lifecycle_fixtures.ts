import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import type { DischargeStatus } from '#models/discharge'

/**
 * A truck reserved by an unreleased assignment on a `PLANNED` or `ACTIVE` discharge — the only
 * shape the shared `SiteReferenceUsageChecker` reports as currently in use.
 */
export async function createReservedTruckScenario({
  status = 'PLANNED' as DischargeStatus,
}: {
  status?: DischargeStatus
} = {}) {
  const truck = await TruckFactory.create()
  const dock = await DockFactory.create()
  const discharge = await DischargeFactory.merge({ status, dockId: dock.id }).create()
  const assignment = await DischargeTruckAssignmentFactory.merge({
    dischargeId: discharge.id,
    truckId: truck.id,
  }).create()

  return { truck, discharge, assignment }
}

/**
 * A truck whose only assignment has been released: current usage must ignore it even though the
 * discharge is still `PLANNED` or `ACTIVE`.
 */
export async function createReleasedTruckScenario({
  status = 'PLANNED' as DischargeStatus,
}: {
  status?: DischargeStatus
} = {}) {
  const truck = await TruckFactory.create()
  const dock = await DockFactory.create()
  const discharge = await DischargeFactory.merge({ status, dockId: dock.id }).create()
  const assignment = await DischargeTruckAssignmentFactory.apply('released')
    .merge({ dischargeId: discharge.id, truckId: truck.id })
    .create()

  return { truck, discharge, assignment }
}

/**
 * A truck whose only assignment belongs to a `CLOSED` discharge: current usage must ignore it
 * even though the assignment itself was never released.
 */
export async function createClosedDischargeTruckScenario() {
  const truck = await TruckFactory.create()
  const dock = await DockFactory.create()
  const discharge = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
  const assignment = await DischargeTruckAssignmentFactory.merge({
    dischargeId: discharge.id,
    truckId: truck.id,
  }).create()

  return { truck, discharge, assignment }
}

/**
 * An archived truck whose current transport company is itself `ARCHIVED` — the one condition
 * that blocks reactivation, since an available truck may never be provided by an archived
 * company.
 */
export async function createArchivedTruckWithArchivedCompanyScenario() {
  const company = await TransportCompanyFactory.apply('archived').create()
  const truck = await TruckFactory.apply('archived')
    .merge({ transportCompanyId: company.id })
    .create()

  return { truck, company }
}
