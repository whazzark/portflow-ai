import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import DischargeTruckAssignment from '#models/discharge_truck_assignment'

export const DischargeTruckAssignmentFactory = factory
  .define(DischargeTruckAssignment, ({ faker }) => ({
    dischargeId: '',
    truckId: '',
    registrationSnapshot: faker.vehicle.vrm(),
    transportCompanyId: null,
    transportCompanyNameSnapshot: faker.company.name(),
    reservedAt: DateTime.now(),
    releasedAt: null,
  }))
  .state('released', (assignment) => {
    assignment.releasedAt = assignment.reservedAt.plus({ days: 1 })
  })
  .build()
