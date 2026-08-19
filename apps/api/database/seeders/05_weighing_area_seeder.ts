import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import User from '#models/user'
import WeighingArea from '#models/weighing_area'

const LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'
const ARCHIVED_AT = DateTime.fromISO('2025-01-15T10:00:00.000Z')
const REACTIVATED_AT = DateTime.fromISO('2025-03-15T10:00:00.000Z')
const ARCHIVED_ONLY_AT = DateTime.fromISO('2025-04-15T10:00:00.000Z')

type DemoWeighingArea = {
  name: string
  latitude: number
  longitude: number
  lifecycle?: 'ARCHIVED' | 'REACTIVATED'
}

// Port Atlantique La Rochelle operates two weighbridges for merchandise weighing.
// Coordinates are positioned on the commercial port / La Pallice site.
const DEMO_WEIGHING_AREAS: DemoWeighingArea[] = [
  {
    name: 'Pont-bascule Nord',
    latitude: 46.1602,
    longitude: -1.2378,
  },
  {
    name: 'Pont-bascule Sud',
    latitude: 46.1528,
    longitude: -1.231,
    lifecycle: 'REACTIVATED',
  },
  {
    name: 'Ancien pont-bascule Chef de Baie',
    latitude: 46.1509,
    longitude: -1.2243,
    lifecycle: 'ARCHIVED',
  },
]

export default class WeighingAreaSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()

    for (const demoWeighingArea of DEMO_WEIGHING_AREAS) {
      const existingWeighingArea = await WeighingArea.query()
        .whereRaw('LOWER(name) = ?', [demoWeighingArea.name.toLowerCase()])
        .first()

      const common = {
        name: demoWeighingArea.name,
        latitude: demoWeighingArea.latitude,
        longitude: demoWeighingArea.longitude,
      }
      const lifecycle =
        demoWeighingArea.lifecycle === 'ARCHIVED'
          ? {
              status: 'ARCHIVED' as const,
              archivedAt: ARCHIVED_ONLY_AT,
              archivedByUserId: actor.id,
              archiveComment: 'Historical weighbridge retained for operational records',
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
            }
          : demoWeighingArea.lifecycle === 'REACTIVATED'
            ? {
                status: 'AVAILABLE' as const,
                archivedAt: ARCHIVED_AT,
                archivedByUserId: actor.id,
                archiveComment: 'Weighbridge suspended for calibration',
                reactivatedAt: REACTIVATED_AT,
                reactivatedByUserId: actor.id,
                reactivationComment: 'Calibration accepted and weighbridge returned to service',
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

      if (existingWeighingArea) {
        existingWeighingArea.merge(managed)
        await existingWeighingArea.save()
        continue
      }

      await WeighingAreaFactory.merge(managed).create()
    }
  }
}
