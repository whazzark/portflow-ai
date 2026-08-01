import Warehouse from '#models/warehouse'
import WarehouseRepository from './warehouse_repository.ts'

export default class LucidWarehouseRepository extends WarehouseRepository {
  list(): Promise<Warehouse[]> {
    return Warehouse.query()
      .preload('footprintPoints', (query) => query.orderBy('position', 'asc'))
      .orderByRaw('LOWER(name) ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }
}
