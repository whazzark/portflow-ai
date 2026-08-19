import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import User from '#models/user'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'

const LIFECYCLE_ACTOR_EMAIL = 'thomas.bernard@portflow.ai'
const ARCHIVED_AT = DateTime.fromISO('2025-01-15T10:00:00.000Z')
const REACTIVATED_AT = DateTime.fromISO('2025-03-15T10:00:00.000Z')
const ARCHIVED_ONLY_AT = DateTime.fromISO('2025-04-15T10:00:00.000Z')

type DemoDoor = {
  warehouse: string
  name: string
  lifecycle?: 'ARCHIVED' | 'REACTIVATED'
  latitude: number
  longitude: number
}

const DEMO_DOORS: DemoDoor[] = [
  {
    warehouse: 'SICA Atlantique - Silos céréaliers',
    name: 'Porte Nord',
    latitude: 46.16045,
    longitude: -1.22855,
  },
  {
    warehouse: 'SICA Atlantique - Silos céréaliers',
    name: 'Porte Historique',
    lifecycle: 'ARCHIVED',
    latitude: 46.16002,
    longitude: -1.22845,
  },
  {
    warehouse: 'Socomac - Entrepôt céréalier',
    name: 'Porte Quai',
    latitude: 46.1547,
    longitude: -1.2228,
  },
  {
    warehouse: 'Ancien entrepôt Chef de Baie',
    name: 'Porte Ancienne',
    lifecycle: 'ARCHIVED',
    latitude: 46.1507,
    longitude: -1.2231,
  },
  {
    warehouse: 'Froid Littoral - Entrepôts frigorifiques',
    name: 'Porte Réfrigérée Est',
    latitude: 46.15455,
    longitude: -1.2197,
  },
  {
    warehouse: 'Froid Littoral - Entrepôts frigorifiques',
    name: 'Porte Réfrigérée Ouest',
    lifecycle: 'ARCHIVED',
    latitude: 46.15415,
    longitude: -1.22015,
  },
  {
    warehouse: 'SDLP - Dépôt de La Pallice',
    name: 'Porte Camions',
    latitude: 46.16035,
    longitude: -1.2396,
  },
  {
    warehouse: 'Atlantique Logistique - Hangar 7',
    name: 'Porte Principale',
    latitude: 46.15365,
    longitude: -1.22135,
  },
  {
    warehouse: 'Atlantique Logistique - Hangar 7',
    name: 'Porte de Service',
    lifecycle: 'REACTIVATED',
    latitude: 46.1533,
    longitude: -1.2222,
  },
  {
    warehouse: 'Port Atlantique - Magasin sous douane',
    name: 'Porte Douane',
    latitude: 46.1552,
    longitude: -1.2205,
  },
  {
    warehouse: 'Port Atlantique - Magasin sous douane',
    name: 'Porte Quai Sud',
    lifecycle: 'ARCHIVED',
    latitude: 46.1548,
    longitude: -1.2211,
  },
  {
    warehouse: 'Ancien hangar de Chef de Baie',
    name: 'Porte condamnée',
    lifecycle: 'ARCHIVED',
    latitude: 46.15055,
    longitude: -1.22165,
  },
]

export default class WarehouseDoorSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()

    for (const demoDoor of DEMO_DOORS) {
      const warehouse = await Warehouse.query()
        .whereRaw('LOWER(name) = ?', [demoDoor.warehouse.toLowerCase()])
        .first()

      if (!warehouse) {
        throw new Error(`Managed warehouse not found for door: ${demoDoor.warehouse}`)
      }

      const lifecycle =
        demoDoor.lifecycle === 'ARCHIVED'
          ? {
              status: 'ARCHIVED' as const,
              archivedAt: ARCHIVED_ONLY_AT,
              archivedByUserId: actor.id,
              archiveComment: 'Door retired from unloading service',
              reactivatedAt: null,
              reactivatedByUserId: null,
              reactivationComment: null,
            }
          : demoDoor.lifecycle === 'REACTIVATED'
            ? {
                status: 'AVAILABLE' as const,
                archivedAt: ARCHIVED_AT,
                archivedByUserId: actor.id,
                archiveComment: 'Door suspended during access repairs',
                reactivatedAt: REACTIVATED_AT,
                reactivatedByUserId: actor.id,
                reactivationComment: 'Door returned to unloading service',
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

      const existingDoor = await WarehouseDoor.query()
        .where('warehouseId', warehouse.id)
        .whereRaw('LOWER(name) = ?', [demoDoor.name.toLowerCase()])
        .first()

      if (existingDoor) {
        existingDoor.merge({
          warehouseId: warehouse.id,
          name: demoDoor.name,
          ...lifecycle,
          latitude: demoDoor.latitude,
          longitude: demoDoor.longitude,
        })
        await existingDoor.save()
        continue
      }

      await WarehouseDoor.create({
        warehouseId: warehouse.id,
        name: demoDoor.name,
        ...lifecycle,
        latitude: demoDoor.latitude,
        longitude: demoDoor.longitude,
      })
    }
  }
}
