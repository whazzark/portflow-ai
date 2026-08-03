import type WarehouseDoor from '#models/warehouse_door'

export default abstract class WarehouseDoorRepository {
  abstract listAvailable(): Promise<WarehouseDoor[]>
}
