import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

export const WarehouseDoorProductLotAssignmentFactory = factory
  .define(WarehouseDoorProductLotAssignment, () => ({
    dischargeId: '',
    warehouseDoorId: '',
    productLotId: '',
    effectiveFrom: DateTime.now(),
    effectiveTo: null,
  }))
  .build()
