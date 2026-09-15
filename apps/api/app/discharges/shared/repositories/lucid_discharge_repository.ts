import db from '@adonisjs/lucid/services/db'

import type {
  DischargeDetailRead,
  OtherHolding,
  TruckCandidatesRead,
} from '#discharges/shared/discharge_detail_read'
import Discharge from '#models/discharge'
import Truck from '#models/truck'
import isUuid from '#shared/database/is_uuid'

import DischargeRepository from './discharge_repository.ts'

export default class LucidDischargeRepository extends DischargeRepository {
  /**
   * Ordered by expected start ascending, with the identity breaking ties. The direction the user
   * reads is a per-tab choice the browsing screen makes; what has to be authoritative here is that
   * two discharges expected at the same minute never swap places between two reads. The lots are
   * ordered on the same terms: unordered, Postgres is free to return them differently between two
   * reads, and the row's customers are read off that order.
   */
  list(): Promise<Discharge[]> {
    return Discharge.query()
      .preload('dock')
      .preload('productLots', (productLots) => productLots.preload('customer').orderBy('id', 'asc'))
      .withCount('shifts')
      .orderBy('expectedStartAt', 'asc')
      .orderBy('id', 'asc')
  }

  /**
   * Nothing in the graph is filtered by status: an archived dock, customer, door, weighing area,
   * truck, or company is part of the discharge's history and has to stay readable.
   */
  async findDetail(id: string): Promise<DischargeDetailRead | null> {
    if (!isUuid(id)) {
      return null
    }

    const discharge = await Discharge.query()
      .where('id', id)
      .preload('dock')
      .preload('productLots', (productLots) =>
        productLots
          // Read by customer, the way a user scans a discharge's lots. The customer's name lives
          // on its own table, so the order needs the join; the preload still reads lot columns.
          .select('product_lots.*')
          .join('customers', 'customers.id', 'product_lots.customer_id')
          .orderBy('customers.company_name', 'asc')
          .orderBy('product_lots.product_name', 'asc')
          .orderBy('product_lots.id', 'asc')
          .preload('customer')
          .preload('doorAssignments', (doorAssignments) =>
            doorAssignments
              .orderBy('effective_from', 'asc')
              .orderBy('id', 'asc')
              .preload('warehouseDoor', (warehouseDoor) => warehouseDoor.preload('warehouse')),
          ),
      )
      // The pool is shown on its own, and its captured registrations also name a shift's trucks.
      .preload('truckAssignments', (truckAssignments) =>
        truckAssignments
          .orderBy('registration_snapshot', 'asc')
          .orderBy('id', 'asc')
          .preload('truck')
          .preload('transportCompany'),
      )
      .preload('shifts', (shifts) =>
        shifts
          .orderBy('planned_start_at', 'asc')
          .orderBy('id', 'asc')
          .preload('responsible')
          .preload('truckMemberships', (memberships) =>
            memberships.orderBy('effective_from', 'asc').orderBy('id', 'asc').preload('truck'),
          )
          .preload('warehouseDoorMemberships', (memberships) =>
            memberships
              .orderBy('effective_from', 'asc')
              .orderBy('id', 'asc')
              .preload('warehouseDoor', (warehouseDoor) => warehouseDoor.preload('warehouse')),
          )
          .preload('weighingAreaMemberships', (memberships) =>
            memberships
              .orderBy('effective_from', 'asc')
              .orderBy('id', 'asc')
              .preload('weighingArea'),
          ),
      )
      .first()

    if (!discharge) {
      return null
    }

    // A closed discharge holds nothing, and a released entry no longer competes with anyone.
    const heldTruckIds =
      discharge.status === 'CLOSED'
        ? []
        : discharge.truckAssignments
            .filter((assignment) => assignment.releasedAt === null)
            .map((assignment) => assignment.truckId)

    return {
      discharge,
      otherHoldings: await this.findOtherHoldings(heldTruckIds, discharge.id),
    }
  }

  async listTruckCandidates(dischargeId: string): Promise<TruckCandidatesRead> {
    if (!isUuid(dischargeId)) {
      return { kind: 'NOT_FOUND' }
    }

    const discharge = await Discharge.query()
      .where('id', dischargeId)
      .select('id', 'status')
      .first()
    if (!discharge) {
      return { kind: 'NOT_FOUND' }
    }
    if (discharge.status !== 'PLANNED') {
      return { kind: 'NOT_PLANNED' }
    }

    const trucks = await Truck.query()
      .where('status', 'AVAILABLE')
      .whereNotExists((held) =>
        held
          .from('discharge_truck_assignments')
          .whereColumn('discharge_truck_assignments.truck_id', 'trucks.id')
          .where('discharge_truck_assignments.discharge_id', discharge.id)
          .whereNull('discharge_truck_assignments.released_at'),
      )
      .preload('transportCompany')
      // biome-ignore lint/security/noSecrets: SQL ordering expression, not a secret
      .orderByRaw('LOWER(registration) ASC')
      .orderBy('id', 'asc')
    const otherHoldings = await this.findOtherHoldings(
      trucks.map((truck) => truck.id),
      discharge.id,
    )

    return {
      kind: 'LISTED',
      candidates: trucks.map((truck) => ({
        id: truck.id,
        registration: truck.registration,
        transportCompany: { id: truck.transportCompanyId, name: truck.transportCompany.name },
        otherHoldings: otherHoldings.get(truck.id.toLowerCase()) ?? [],
      })),
    }
  }

  /**
   * The planned and active discharges, other than `dischargeId`, that hold each of these trucks.
   * One query for every truck at once, so a pool of fifty trucks costs one read, not fifty. Active
   * holders come first: they are the ones a start confirmation would be refused against.
   */
  protected async findOtherHoldings(truckIds: string[], dischargeId: string) {
    const holdings = new Map<string, OtherHolding[]>()
    if (truckIds.length === 0) {
      return holdings
    }

    const rows: Array<{
      truck_id: string
      discharge_id: string
      vessel_name: string
      status: OtherHolding['status']
    }> = await db
      .from('discharge_truck_assignments')
      .join('discharges', 'discharges.id', 'discharge_truck_assignments.discharge_id')
      .whereIn('discharge_truck_assignments.truck_id', truckIds)
      .whereNull('discharge_truck_assignments.released_at')
      .whereIn('discharges.status', ['PLANNED', 'ACTIVE'])
      .whereNot('discharges.id', dischargeId)
      .select(
        'discharge_truck_assignments.truck_id',
        'discharges.id as discharge_id',
        'discharges.vessel_name',
        'discharges.status',
      )
      .orderByRaw("CASE discharges.status WHEN 'ACTIVE' THEN 0 ELSE 1 END")
      .orderBy('discharges.vessel_name', 'asc')
      .orderBy('discharges.id', 'asc')

    for (const row of rows) {
      const key = row.truck_id.toLowerCase()
      const holding = {
        dischargeId: row.discharge_id,
        vesselName: row.vessel_name,
        status: row.status,
      }
      holdings.set(key, [...(holdings.get(key) ?? []), holding])
    }

    return holdings
  }
}
