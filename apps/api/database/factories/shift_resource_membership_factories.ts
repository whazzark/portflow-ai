import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'

const membershipTimes = () => ({
  effectiveFrom: DateTime.now(),
  effectiveTo: null,
})

export const ShiftTruckFactory = factory
  .define(ShiftTruck, () => ({ shiftId: '', truckId: '', ...membershipTimes() }))
  .build()

export const ShiftWarehouseDoorFactory = factory
  .define(ShiftWarehouseDoor, () => ({ shiftId: '', warehouseDoorId: '', ...membershipTimes() }))
  .build()

export const ShiftWeighingAreaFactory = factory
  .define(ShiftWeighingArea, () => ({ shiftId: '', weighingAreaId: '', ...membershipTimes() }))
  .build()
