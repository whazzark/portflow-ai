import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WAREHOUSE_FIXTURES } from '#database/fixtures/warehouses'
import Warehouse from '#models/warehouse'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

export default class WarehouseSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of WAREHOUSE_FIXTURES) {
      const byId = await Warehouse.find(fixture.id)
      const byName = await Warehouse.query()
        .whereRaw('LOWER(name) = ?', [fixture.attributes.name.toLowerCase()])
        .first()
      if (byName && byName.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for warehouse: ${fixture.attributes.name}. Run migration:fresh.`,
        )
      }
      const factory =
        fixture.state === 'available' ? WarehouseFactory : WarehouseFactory.apply(fixture.state)
      const candidate = await factory.merge({ id: fixture.id, ...fixture.attributes }).make()
      if (byId) {
        byId.merge(candidate.$attributes)
        await byId.save()
      } else {
        await candidate.save()
      }
      await WarehouseFootprintPoint.query().where('warehouseId', fixture.id).delete()
      await WarehouseFootprintPoint.createMany(
        fixture.footprint.map((point) => ({ warehouseId: fixture.id, ...point })),
      )
    }
  }
}
