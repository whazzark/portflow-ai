import { BaseSeeder } from '@adonisjs/lucid/seeders'

import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse, { type WarehouseStatus } from '#models/warehouse'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

type DemoWarehouse = {
  name: string
  status?: WarehouseStatus
  footprint: Array<{ latitude: number; longitude: number }>
}

// Representative storage facilities located in the commercial port of La Pallice.
// Coordinates describe the operational footprint used by the map, not cadastral boundaries.
const DEMO_WAREHOUSES: DemoWarehouse[] = [
  {
    name: 'SICA Atlantique - Silos céréaliers',
    footprint: [
      { latitude: 46.16155, longitude: -1.23055 },
      { latitude: 46.16155, longitude: -1.2278 },
      { latitude: 46.16035, longitude: -1.2278 },
      { latitude: 46.16035, longitude: -1.23055 },
    ],
  },
  {
    name: 'Socomac - Entrepôt céréalier',
    footprint: [
      { latitude: 46.1572, longitude: -1.23525 },
      { latitude: 46.1572, longitude: -1.2326 },
      { latitude: 46.15595, longitude: -1.2326 },
      { latitude: 46.15595, longitude: -1.23525 },
    ],
  },
  {
    name: 'Froid Littoral - Entrepôts frigorifiques',
    footprint: [
      { latitude: 46.15365, longitude: -1.2204 },
      { latitude: 46.15365, longitude: -1.21795 },
      { latitude: 46.15245, longitude: -1.21795 },
      { latitude: 46.15245, longitude: -1.2204 },
    ],
  },
  {
    name: 'SDLP - Dépôt de La Pallice',
    footprint: [
      { latitude: 46.15555, longitude: -1.24125 },
      { latitude: 46.15555, longitude: -1.2384 },
      { latitude: 46.1541, longitude: -1.2384 },
      { latitude: 46.1541, longitude: -1.24125 },
    ],
  },
  {
    name: 'Ancien entrepôt Chef de Baie',
    status: 'ARCHIVED',
    footprint: [
      { latitude: 46.14995, longitude: -1.2274 },
      { latitude: 46.14995, longitude: -1.2249 },
      { latitude: 46.1488, longitude: -1.2249 },
      { latitude: 46.1488, longitude: -1.2274 },
    ],
  },
  {
    name: 'Ancien dépôt pétrolier',
    status: 'ARCHIVED',
    footprint: [
      { latitude: 46.15645, longitude: -1.2441 },
      { latitude: 46.15645, longitude: -1.2418 },
      { latitude: 46.15535, longitude: -1.2418 },
      { latitude: 46.15535, longitude: -1.2441 },
    ],
  },
]

export default class WarehouseSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const demoWarehouse of DEMO_WAREHOUSES) {
      const existingWarehouse = await Warehouse.query()
        .whereRaw('LOWER(name) = ?', [demoWarehouse.name.toLowerCase()])
        .first()

      if (existingWarehouse) {
        continue
      }

      const warehouse =
        demoWarehouse.status === 'ARCHIVED'
          ? await WarehouseFactory.apply('archived').merge({ name: demoWarehouse.name }).create()
          : await WarehouseFactory.merge({ name: demoWarehouse.name }).create()

      await WarehouseFootprintPoint.createMany(
        demoWarehouse.footprint.map((point, position) => ({
          warehouseId: warehouse.id,
          position,
          ...point,
        })),
      )
    }
  }
}
