import Warehouse from '#models/warehouse'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import isUniqueViolation from '#shared/database/is_unique_violation'
import WarehouseRepository, {
  type CreateWarehouseCommand,
  type CreateWarehouseResult,
} from './warehouse_repository.ts'

export default class LucidWarehouseRepository extends WarehouseRepository {
  async create(command: CreateWarehouseCommand): Promise<CreateWarehouseResult> {
    try {
      const warehouse = await Warehouse.transaction(async (trx) => {
        const created = await Warehouse.create(
          { name: command.name, status: 'AVAILABLE' },
          { client: trx },
        )

        // `position` comes from the submitted order, which is the drawn order: it is what makes the
        // stored ring reproduce the outline the administrator drew.
        await WarehouseFootprintPoint.createMany(
          command.points.map((point, position) => ({
            warehouseId: created.id,
            position,
            latitude: point.latitude,
            longitude: point.longitude,
          })),
          { client: trx },
        )

        return created
      })

      // The transformer reads `footprintPoints` and `doors` and rejects a footprint under three
      // points, so a freshly created instance must be reloaded before it can be serialized.
      await warehouse.load('footprintPoints', (query) => query.orderBy('position', 'asc'))
      await warehouse.load('doors')

      return { kind: 'CREATED', warehouse }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  list(): Promise<Warehouse[]> {
    return Warehouse.query()
      .preload('footprintPoints', (query) => query.orderBy('position', 'asc'))
      .preload('doors', (query) =>
        query.orderByRaw('LOWER(name) ASC').orderBy('name', 'asc').orderBy('id', 'asc'),
      )
      .orderByRaw('LOWER(name) ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }
}
