import factory from '@adonisjs/lucid/factories'
import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import Truck from '#models/truck'

export const TruckFactory = factory
  .define(Truck, ({ faker }) => ({
    registration: faker.vehicle.vrm(),
    vehicleModel: faker.helpers.maybe(() => faker.vehicle.model()) ?? null,
    capacityTonnes: new Decimal(String(faker.number.float({ fractionDigits: 3, max: 50, min: 1 }))),
    transportCompanyId: '',
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (truck) => {
    truck.status = 'ARCHIVED'
    truck.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (truck) => {
    truck.status = 'AVAILABLE'
    truck.archivedAt ??= DateTime.now().minus({ days: 30 })
    truck.reactivatedAt ??= DateTime.now()
  })
  .before('create', async (_builder, truck, context) => {
    if (truck.transportCompanyId) {
      return
    }

    const companyFactory = context.$trx
      ? TransportCompanyFactory.client(context.$trx)
      : TransportCompanyFactory
    const company = await companyFactory.create()
    truck.transportCompanyId = company.id
  })
  .build()
