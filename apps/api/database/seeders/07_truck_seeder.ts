import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'
import User from '#models/user'

const DEMO_TRUCKS = [
  {
    registration: 'AA-101-PF',
    vehicleModel: 'Volvo FMX',
    capacityTonnes: '32.5',
    companyName: 'Atlantique Transport Routier',
    lifecycle: 'AVAILABLE' as const,
  },
  {
    registration: 'BB-202-PF',
    vehicleModel: null,
    capacityTonnes: '28.75',
    companyName: 'Armor Fret Services',
    lifecycle: 'AVAILABLE' as const,
  },
  {
    registration: 'CC-303-PF',
    vehicleModel: 'Renault Trucks C',
    capacityTonnes: '30',
    companyName: 'Estuaire Bennes',
    lifecycle: 'REACTIVATED' as const,
  },
  {
    registration: 'ZZ-909-PF',
    vehicleModel: 'Scania XT',
    capacityTonnes: '34.25',
    companyName: 'Loire Vrac Transport',
    lifecycle: 'ARCHIVED' as const,
  },
]

export default class TruckSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const actor = await User.query().where('accessStatus', 'ACTIVE').first()
    const now = DateTime.now()

    for (const [index, demo] of DEMO_TRUCKS.entries()) {
      const existing = await Truck.query()
        // biome-ignore lint/security/noSecrets: SQL lookup expression, not a secret
        .whereRaw('LOWER(registration) = ?', [demo.registration.toLowerCase()])
        .first()

      if (existing) {
        continue
      }

      const company = await TransportCompany.query()
        .whereRaw('LOWER(name) = ?', [demo.companyName.toLowerCase()])
        .firstOrFail()
      const common = {
        registration: demo.registration,
        vehicleModel: demo.vehicleModel,
        capacityTonnes: demo.capacityTonnes,
        transportCompanyId: company.id,
        createdAt: now.minus({ days: 150 + index * 20 }),
      }

      if (demo.lifecycle === 'ARCHIVED') {
        const occurredAt = now.minus({ days: 60 })
        await TruckFactory.apply('archived')
          .merge({
            ...common,
            archivedAt: occurredAt,
            archivedByUserId: actor?.id ?? null,
            archiveComment: 'Vehicle retired from the fleet',
            updatedAt: occurredAt,
          })
          .create()
        continue
      }

      if (demo.lifecycle === 'REACTIVATED') {
        const occurredAt = now.minus({ days: 15 })
        await TruckFactory.apply('reactivated')
          .merge({
            ...common,
            archivedAt: now.minus({ days: 75 }),
            reactivatedAt: occurredAt,
            reactivatedByUserId: actor?.id ?? null,
            reactivationComment: 'Vehicle returned to the active fleet',
            updatedAt: occurredAt,
          })
          .create()
        continue
      }

      await TruckFactory.merge(common).create()
    }
  }
}
