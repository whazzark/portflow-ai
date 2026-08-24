import type { Decimal } from 'decimal.js'

import type Truck from '#models/truck'

export type CreateTruckCommand = {
  registration: string
  vehicleModel: string | null
  capacityTonnes: Decimal.Value
  transportCompanyId: string
}

export type TruckWriteResult =
  | { kind: 'CREATED'; truck: Truck }
  | { kind: 'DUPLICATE_REGISTRATION' }

export default abstract class TruckRepository {
  abstract list(): Promise<Truck[]>
  abstract listAvailable(): Promise<Truck[]>
  abstract create(command: CreateTruckCommand): Promise<TruckWriteResult>
}
