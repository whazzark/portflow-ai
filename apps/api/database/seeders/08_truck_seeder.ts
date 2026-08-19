import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'
import User from '#models/user'

const LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'
const DATASET_REFERENCE_DATE = DateTime.fromISO('2025-06-01T10:00:00.000Z')

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
    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()
    const now = DATASET_REFERENCE_DATE

    for (const [index, demo] of DEMO_TRUCKS.entries()) {
      const companyMatches = await TransportCompany.query()
        .whereRaw('LOWER(name) = ?', [demo.companyName.toLowerCase()])
        .limit(2)

      if (companyMatches.length === 0) {
        throw new Error(`Managed transport company not found for truck: ${demo.companyName}`)
      }

      if (companyMatches.length > 1) {
        throw new Error(`Managed transport company is ambiguous for truck: ${demo.companyName}`)
      }

      const existing = await Truck.query()
        // biome-ignore lint/security/noSecrets: SQL lookup expression, not a secret
        .whereRaw('LOWER(registration) = ?', [demo.registration.toLowerCase()])
        .first()
      const company = companyMatches[0]
      const common = {
        registration: demo.registration,
        vehicleModel: demo.vehicleModel,
        capacityTonnes: demo.capacityTonnes,
        transportCompanyId: company.id,
      }
      const lifecycle =
        demo.lifecycle === 'ARCHIVED'
          ? {
              status: 'ARCHIVED' as const,
              archivedAt: now.minus({ days: 60 }),
              archivedByUserId: actor.id,
              archiveComment: 'Vehicle retired from the fleet',
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
            }
          : demo.lifecycle === 'REACTIVATED'
            ? {
                status: 'AVAILABLE' as const,
                archivedAt: now.minus({ days: 75 }),
                archivedByUserId: actor.id,
                archiveComment: 'Vehicle temporarily suspended for fleet maintenance',
                reactivatedAt: now.minus({ days: 15 }),
                reactivatedByUserId: actor.id,
                reactivationComment: 'Vehicle returned to the active fleet',
              }
            : {
                status: 'AVAILABLE' as const,
                archivedAt: null,
                archivedByUserId: null,
                archiveComment: null,
                reactivatedAt: null,
                reactivatedByUserId: null,
                reactivationComment: null,
              }
      const managed = { ...common, ...lifecycle }

      if (existing) {
        existing.merge(managed)
        await existing.save()
        continue
      }

      await TruckFactory.merge({
        ...managed,
        createdAt: now.minus({ days: 150 + index * 20 }),
      }).create()
    }
  }
}
