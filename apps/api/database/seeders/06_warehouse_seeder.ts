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
      { latitude: 46.1603461, longitude: -1.2289286 },
      { latitude: 46.1605988, longitude: -1.2284251 },
      { latitude: 46.1601449, longitude: -1.2279454 },
      { latitude: 46.159887, longitude: -1.2284485 },
      { latitude: 46.1600924, longitude: -1.2286602 },
      { latitude: 46.1602171, longitude: -1.2288759 },
    ],
  },
  {
    name: 'Socomac - Entrepôt céréalier',
    footprint: [
      { latitude: 46.1551511, longitude: -1.2223178 },
      { latitude: 46.1545061, longitude: -1.2235452 },
      { latitude: 46.1541982, longitude: -1.2232383 },
      { latitude: 46.1548286, longitude: -1.221958 },
    ],
  },
  {
    name: 'Froid Littoral - Entrepôts frigorifiques',
    footprint: [
      { latitude: 46.154863, longitude: -1.219506 },
      { latitude: 46.154335, longitude: -1.220558 },
      { latitude: 46.153971, longitude: -1.220178 },
      { latitude: 46.154495, longitude: -1.219124 },
    ],
  },
  {
    name: 'SDLP - Dépôt de La Pallice',
    footprint: [
      { latitude: 46.159936, longitude: -1.24 },
      { latitude: 46.1599036, longitude: -1.239478 },
      { latitude: 46.160716, longitude: -1.239313 },
      { latitude: 46.160764, longitude: -1.239841 },
      { latitude: 46.160248, longitude: -1.23994 },
    ],
  },
  {
    name: 'Ancien entrepôt Chef de Baie',
    status: 'ARCHIVED',
    footprint: [
      { latitude: 46.150477, longitude: -1.223374 },
      { latitude: 46.150616, longitude: -1.222687 },
      { latitude: 46.150859, longitude: -1.222843 },
      { latitude: 46.151113, longitude: -1.22341 },
      { latitude: 46.150945, longitude: -1.223724 },
      { latitude: 46.150526, longitude: -1.223461 },
    ],
  },
  {
    name: 'Ancien dépôt pétrolier',
    status: 'ARCHIVED',
    footprint: [
      { latitude: 46.1513461, longitude: -1.229668 },
      { latitude: 46.1515376, longitude: -1.2293636 },
      { latitude: 46.1514021, longitude: -1.2291859 },
      { latitude: 46.1511319, longitude: -1.229068 },
      { latitude: 46.1510455, longitude: -1.2292052 },
      { latitude: 46.1512333, longitude: -1.2294514 },
    ],
  },
  {
    name: 'Atlantique Logistique - Hangar 7',
    footprint: [
      { latitude: 46.1539637, longitude: -1.2212914 },
      { latitude: 46.1533187, longitude: -1.2225188 },
      { latitude: 46.1530108, longitude: -1.2222119 },
      { latitude: 46.1536412, longitude: -1.2209316 },
    ],
  },
  {
    name: 'Port Atlantique - Magasin sous douane',
    footprint: [
      { latitude: 46.155421, longitude: -1.220314 },
      { latitude: 46.154899, longitude: -1.221363 },
      { latitude: 46.154532, longitude: -1.220986 },
      { latitude: 46.155056, longitude: -1.219928 },
    ],
  },
  {
    name: 'Ancien hangar de Chef de Baie',
    status: 'ARCHIVED',
    footprint: [
      { latitude: 46.150564, longitude: -1.221884 },
      { latitude: 46.150439, longitude: -1.221807 },
      { latitude: 46.150542, longitude: -1.221467 },
      { latitude: 46.150667, longitude: -1.221545 },
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

      const warehouse =
        existingWarehouse ??
        (demoWarehouse.status === 'ARCHIVED'
          ? await WarehouseFactory.apply('archived').merge({ name: demoWarehouse.name }).create()
          : await WarehouseFactory.merge({ name: demoWarehouse.name }).create())

      if (existingWarehouse && existingWarehouse.status !== (demoWarehouse.status ?? 'AVAILABLE')) {
        existingWarehouse.status = demoWarehouse.status ?? 'AVAILABLE'
        await existingWarehouse.save()
      }

      await WarehouseFootprintPoint.query().where('warehouseId', warehouse.id).delete()

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
