import Discharge from '#models/discharge'
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
  async findDetail(id: string): Promise<Discharge | null> {
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

    return discharge
  }
}
