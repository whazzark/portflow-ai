import type Truck from '#models/truck'

export default abstract class TruckRepository {
  abstract list(): Promise<Truck[]>
  abstract listAvailable(): Promise<Truck[]>
}
