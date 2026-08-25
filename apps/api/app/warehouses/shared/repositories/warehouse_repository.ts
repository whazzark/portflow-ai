import type Warehouse from '#models/warehouse'

export type WarehouseFootprintPointCommand = { latitude: number; longitude: number }

export type CreateWarehouseCommand = {
  name: string
  points: WarehouseFootprintPointCommand[]
}

export type CreateWarehouseResult =
  | { kind: 'CREATED'; warehouse: Warehouse }
  | { kind: 'DUPLICATE_NAME' }

export default abstract class WarehouseRepository {
  abstract create(command: CreateWarehouseCommand): Promise<CreateWarehouseResult>

  abstract list(): Promise<Warehouse[]>
}
