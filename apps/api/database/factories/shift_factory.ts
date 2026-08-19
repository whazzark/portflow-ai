import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Shift from '#models/shift'

export const ShiftFactory = factory
  .define(Shift, ({ faker }) => {
    const start = DateTime.now().plus({ days: 7, hours: faker.number.int({ min: 1, max: 8 }) })
    return {
      dischargeId: '',
      sequence: 1,
      status: 'PLANNED' as const,
      plannedStartAt: start,
      plannedEndAt: start.plus({ hours: 8 }),
      responsibleUserId: '',
    }
  })
  .state('active', (shift) => {
    shift.status = 'ACTIVE'
  })
  .state('completed', (shift) => {
    shift.status = 'COMPLETED'
  })
  .build()
