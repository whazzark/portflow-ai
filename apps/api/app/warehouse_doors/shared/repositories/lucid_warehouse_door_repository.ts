import WarehouseDoor from '#models/warehouse_door'
import WarehouseDoorRepository from './warehouse_door_repository.ts'

export default class LucidWarehouseDoorRepository extends WarehouseDoorRepository {
  listAvailable(): Promise<WarehouseDoor[]> {
    return WarehouseDoor.query()
      .where('status', 'AVAILABLE')
      .whereHas('warehouse', (query) => query.where('status', 'AVAILABLE'))
      .orderBy('warehouse_id', 'asc')
      .orderByRaw('LOWER(name) ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }
}
