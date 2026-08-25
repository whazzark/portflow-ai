import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { ShiftTruckFactory } from '#database/factories/shift_resource_membership_factories'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
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

/**
 * A suspended truck — temporarily out of service, still a live reference. Neither available nor
 * archived, so it is refused by every lifecycle action that expects one of those two states.
 */
export async function createSuspendedTruckScenario() {
  const company = await TransportCompanyFactory.create()
  const truck = await TruckFactory.apply('suspended')
    .merge({ transportCompanyId: company.id })
    .create()

  return { truck, company }
}

/**
 * A suspended truck whose current transport company is `ARCHIVED` — the one condition that blocks
 * returning it to service. A suspended truck is not counted as an available truck, so its company
 * can legitimately be archived while the vehicle is out of service.
 */
export async function createSuspendedTruckWithArchivedCompanyScenario() {
  const company = await TransportCompanyFactory.apply('archived').create()
  const truck = await TruckFactory.apply('suspended')
    .merge({ transportCompanyId: company.id })
    .create()

  return { truck, company }
}

/**
 * An available truck reserved by an unreleased assignment on a `PLANNED` or `ACTIVE` discharge
 * *and* assigned to a shift of that discharge — the shape that must still be suspendable, unlike
 * archival, and whose assignments suspension must leave untouched.
 */
export async function createReservedAndShiftedTruckScenario({
  status = 'ACTIVE' as DischargeStatus,
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
  const responsible = await UserFactory.apply('active').create()
  const shift = await ShiftFactory.apply('active')
    .merge({ dischargeId: discharge.id, responsibleUserId: responsible.id })
    .create()
  const shiftTruck = await ShiftTruckFactory.merge({
    shiftId: shift.id,
    truckId: truck.id,
  }).create()

  return { truck, discharge, assignment, shift, shiftTruck }
}
