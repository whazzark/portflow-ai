import factory from '@adonisjs/lucid/factories'
import Warehouse from '#models/warehouse'

export const WarehouseFactory = factory
  .define(Warehouse, ({ faker }) => ({
    name: `${faker.location.city()} Warehouse`,
    status: 'AVAILABLE' as const,
  }))
  .state('archived', (warehouse) => {
    warehouse.status = 'ARCHIVED'
  })
  .build()
