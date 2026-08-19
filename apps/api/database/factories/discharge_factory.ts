import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Discharge from '#models/discharge'

export const DischargeFactory = factory
  .define(Discharge, ({ faker }) => ({
    status: 'PLANNED' as const,
    vesselName: `${faker.company.name()} Bulk Carrier`,
    vesselImo: faker.string.numeric({ length: 7 }),
    vesselComment: null,
    dockId: '',
    expectedStartAt: DateTime.now().plus({ days: 7 }),
  }))
  .state('active', (discharge) => {
    discharge.status = 'ACTIVE'
  })
  .state('closed', (discharge) => {
    discharge.status = 'CLOSED'
    discharge.expectedStartAt = DateTime.now().minus({ days: 30 })
  })
  .build()
