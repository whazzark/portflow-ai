import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'

type DemoDoor = {
  warehouse: string
  name: string
  status?: 'AVAILABLE' | 'ARCHIVED'
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
    status: 'ARCHIVED',
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
    status: 'ARCHIVED',
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
    status: 'ARCHIVED',
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
    status: 'ARCHIVED',
    latitude: 46.1548,
    longitude: -1.2211,
  },
  {
    warehouse: 'Ancien hangar de Chef de Baie',
    name: 'Porte condamnée',
    status: 'ARCHIVED',
    latitude: 46.15055,
    longitude: -1.22165,
  },
]

export default class WarehouseDoorSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const demoDoor of DEMO_DOORS) {
      const warehouse = await Warehouse.query().where('name', demoDoor.warehouse).first()
      if (!warehouse) {
        continue
      }

      const existingDoor = await WarehouseDoor.query()
        .where('warehouseId', warehouse.id)
        .whereRaw('LOWER(name) = ?', [demoDoor.name.toLowerCase()])
        .first()

      if (existingDoor) {
        existingDoor.merge({
          status: demoDoor.status ?? 'AVAILABLE',
          latitude: demoDoor.latitude,
          longitude: demoDoor.longitude,
        })
        await existingDoor.save()
        continue
      }

      await WarehouseDoor.create({
        warehouseId: warehouse.id,
        name: demoDoor.name,
        status: demoDoor.status ?? 'AVAILABLE',
        latitude: demoDoor.latitude,
        longitude: demoDoor.longitude,
      })
    }
  }
}
