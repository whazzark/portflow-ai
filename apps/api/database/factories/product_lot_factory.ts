import factory from '@adonisjs/lucid/factories'
import { Decimal } from 'decimal.js'

import ProductLot from '#models/product_lot'

export const ProductLotFactory = factory
  .define(ProductLot, ({ faker }) => ({
    dischargeId: '',
    customerId: '',
    productName: faker.commerce.productName(),
    expectedQuantityTonnes: new Decimal(
      String(faker.number.float({ fractionDigits: 3, max: 1000, min: 1 })),
    ),
    description: faker.lorem.sentence(),
  }))
  .build()
