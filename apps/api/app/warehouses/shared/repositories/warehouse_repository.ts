import type Warehouse from '#models/warehouse'

export default abstract class WarehouseRepository {
  abstract list(): Promise<Warehouse[]>
}
