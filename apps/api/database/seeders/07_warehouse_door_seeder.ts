import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WAREHOUSE_DOOR_FIXTURES } from '#database/fixtures/warehouse_doors'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'

export default class WarehouseDoorSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of WAREHOUSE_DOOR_FIXTURES) {
      if (!(await Warehouse.find(fixture.attributes.warehouseId))) {
        throw new Error(`Fixture warehouse not found for door: ${fixture.attributes.name}`)
      }
      const byId = await WarehouseDoor.find(fixture.id)
      const byName = await WarehouseDoor.query()
        .where('warehouseId', fixture.attributes.warehouseId)
        .whereRaw('LOWER(name) = ?', [fixture.attributes.name.toLowerCase()])
        .first()
      if (byName && byName.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for warehouse door: ${fixture.attributes.name}. Run migration:fresh.`,
        )
      }
      const factory =
        fixture.state === 'available'
          ? WarehouseDoorFactory
          : WarehouseDoorFactory.apply(fixture.state)
      const candidate = await factory.merge({ id: fixture.id, ...fixture.attributes }).make()
      if (byId) {
        byId.merge(candidate.$attributes)
        await byId.save()
      } else {
        await candidate.save()
      }
    }
  }
}
