import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import type { DischargeStatus } from '#models/discharge'

export async function createPersistedCustomerUsageScenario({
  status = 'PLANNED' as DischargeStatus,
}: {
  status?: DischargeStatus
} = {}) {
  const [customer, dock] = await Promise.all([CustomerFactory.create(), DockFactory.create()])
  const discharge = await DischargeFactory.merge({ dockId: dock.id, status }).create()
  const productLot = await ProductLotFactory.merge({
    dischargeId: discharge.id,
    customerId: customer.id,
  }).create()

  return { customer, dock, discharge, productLot }
}
