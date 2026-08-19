import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import TransportCompany from '#models/transport_company'
import User from '#models/user'

const LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'
const DATASET_REFERENCE_DATE = DateTime.fromISO('2025-06-01T10:00:00.000Z')

const DEMO_COMPANIES = [
  { name: 'Atlantique Transport Routier', lifecycle: 'AVAILABLE' as const },
  { name: 'Armor Fret Services', lifecycle: 'AVAILABLE' as const },
  { name: 'Estuaire Bennes', lifecycle: 'REACTIVATED' as const },
  { name: 'Grand Ouest Camions', lifecycle: 'AVAILABLE' as const },
  { name: 'Loire Vrac Transport', lifecycle: 'ARCHIVED' as const },
  { name: 'Noroît Logistique', lifecycle: 'ARCHIVED_NULLABLE' as const },
]

export default class TransportCompanySeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()
    const now = DATASET_REFERENCE_DATE

    for (const [index, demo] of DEMO_COMPANIES.entries()) {
      const matches = await TransportCompany.query()
        .whereRaw('LOWER(name) = ?', [demo.name.toLowerCase()])
        .limit(2)

      if (matches.length > 1) {
        throw new Error(`Managed transport company name is ambiguous: ${demo.name}`)
      }

      const lifecycle =
        demo.lifecycle === 'ARCHIVED'
          ? {
              status: 'ARCHIVED' as const,
              archivedAt: now.minus({ days: 90 }),
              archivedByUserId: actor.id,
              archiveComment: 'Provider no longer serves the site',
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
            }
          : demo.lifecycle === 'ARCHIVED_NULLABLE'
            ? {
                status: 'ARCHIVED' as const,
                archivedAt: now.minus({ days: 240 }),
                archivedByUserId: null,
                archiveComment: 'Historical provider retained without a resolvable actor',
                reactivatedAt: null,
                reactivatedByUserId: null,
                reactivationComment: null,
              }
            : demo.lifecycle === 'REACTIVATED'
              ? {
                  status: 'AVAILABLE' as const,
                  archivedAt: now.minus({ days: 120 }),
                  archivedByUserId: actor.id,
                  archiveComment: 'Provider temporarily suspended during contract review',
                  reactivatedAt: now.minus({ days: 35 }),
                  reactivatedByUserId: actor.id,
                  reactivationComment: 'Contract renewed for the current season',
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
      const managed = { name: demo.name, ...lifecycle }
      const existing = matches[0]

      if (existing) {
        existing.merge(managed)
        await existing.save()
        continue
      }

      await TransportCompanyFactory.merge({
        ...managed,
        createdAt: now.minus({ days: 180 + index * 23 }),
      }).create()
    }
  }
}
