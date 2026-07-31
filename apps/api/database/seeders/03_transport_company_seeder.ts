import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import TransportCompany from '#models/transport_company'
import User from '#models/user'

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
    const actor = await User.query().where('accessStatus', 'ACTIVE').first()
    const now = DateTime.now()

    for (const [index, demo] of DEMO_COMPANIES.entries()) {
      const existing = await TransportCompany.query()
        .whereRaw('LOWER(name) = ?', [demo.name.toLowerCase()])
        .first()

      if (existing) {
        continue
      }

      const common = {
        name: demo.name,
        createdAt: now.minus({ days: 180 + index * 23 }),
      }

      if (demo.lifecycle === 'ARCHIVED') {
        const occurredAt = now.minus({ days: 90 })
        await TransportCompanyFactory.apply('archived')
          .merge({
            ...common,
            archivedAt: occurredAt,
            archivedByUserId: actor?.id ?? null,
            archiveComment: 'Provider no longer serves the site',
            updatedAt: occurredAt,
          })
          .create()
        continue
      }

      if (demo.lifecycle === 'ARCHIVED_NULLABLE') {
        const occurredAt = now.minus({ days: 240 })
        await TransportCompanyFactory.apply('archived')
          .merge({ ...common, archivedAt: occurredAt, updatedAt: occurredAt })
          .create()
        continue
      }

      if (demo.lifecycle === 'REACTIVATED') {
        const occurredAt = now.minus({ days: 35 })
        await TransportCompanyFactory.apply('reactivated')
          .merge({
            ...common,
            archivedAt: now.minus({ days: 120 }),
            reactivatedAt: occurredAt,
            reactivatedByUserId: actor?.id ?? null,
            reactivationComment: 'Contract renewed for the current season',
            updatedAt: occurredAt,
          })
          .create()
        continue
      }

      await TransportCompanyFactory.merge(common).create()
    }
  }
}
