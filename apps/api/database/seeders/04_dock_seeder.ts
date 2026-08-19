import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import { DockFactory } from '#database/factories/dock_factory'
import Dock from '#models/dock'
import User from '#models/user'

const LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'
const ARCHIVED_AT = DateTime.fromISO('2025-01-15T10:00:00.000Z')
const REACTIVATED_AT = DateTime.fromISO('2025-03-15T10:00:00.000Z')
const ARCHIVED_ONLY_AT = DateTime.fromISO('2025-04-15T10:00:00.000Z')

type DemoDock = {
  name: string
  latitude: number
  longitude: number
  lifecycle?: 'ARCHIVED' | 'REACTIVATED'
}

const DEMO_DOCKS: DemoDock[] = [
  { name: "Môle d'Escale Ouest", latitude: 46.16088, longitude: -1.23972 },
  { name: "Môle d'Escale Est", latitude: 46.16052, longitude: -1.23565 },
  { name: 'Anse Saint-Marc 1', latitude: 46.15589, longitude: -1.23648 },
  { name: 'Anse Saint-Marc 2', latitude: 46.15431, longitude: -1.23318 },
  { name: 'Chef de Baie 1', latitude: 46.15163, longitude: -1.22958 },
  { name: 'Chef de Baie 2', latitude: 46.14983, longitude: -1.22664 },
  {
    name: 'Chef de Baie 3',
    latitude: 46.14868,
    longitude: -1.22383,
    lifecycle: 'ARCHIVED',
  },
  { name: 'Quai Lombard Nord', latitude: 46.16232, longitude: -1.22537 },
  {
    name: 'Quai Lombard Sud',
    latitude: 46.16078,
    longitude: -1.22284,
    lifecycle: 'ARCHIVED',
  },
  { name: 'Appontement pétrolier AP00', latitude: 46.15669, longitude: -1.24291 },
  { name: 'Bassin à flot 1', latitude: 46.15865, longitude: -1.2189 },
  {
    name: 'Bassin à flot 2',
    latitude: 46.15747,
    longitude: -1.21678,
    lifecycle: 'REACTIVATED',
  },
]

export default class DockSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()

    for (const demoDock of DEMO_DOCKS) {
      const existingDock = await Dock.query()
        .whereRaw('LOWER(name) = ?', [demoDock.name.toLowerCase()])
        .first()

      const common = {
        name: demoDock.name,
        latitude: demoDock.latitude,
        longitude: demoDock.longitude,
      }
      const lifecycle =
        demoDock.lifecycle === 'ARCHIVED'
          ? {
              status: 'ARCHIVED' as const,
              archivedAt: ARCHIVED_ONLY_AT,
              archivedByUserId: actor.id,
              archiveComment: 'Dock retired from the current operating perimeter',
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
            }
          : demoDock.lifecycle === 'REACTIVATED'
            ? {
                status: 'AVAILABLE' as const,
                archivedAt: ARCHIVED_AT,
                archivedByUserId: actor.id,
                archiveComment: 'Dock temporarily unavailable during maintenance',
                reactivatedAt: REACTIVATED_AT,
                reactivatedByUserId: actor.id,
                reactivationComment: 'Dock returned to operational service',
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

      if (existingDock) {
        existingDock.merge(managed)
        await existingDock.save()
        continue
      }

      await DockFactory.merge(managed).create()
    }
  }
}
