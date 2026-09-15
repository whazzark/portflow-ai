import { Decimal } from 'decimal.js'

export type ProductLotInput = {
  customerId: string
  productName: string
  expectedQuantityTonnes: string
  description: string | null
}

export function normalizeProductLot(input: ProductLotInput) {
  return {
    customerId: input.customerId,
    productName: input.productName.trim(),
    expectedQuantityTonnes: new Decimal(input.expectedQuantityTonnes),
    description: input.description?.trim() || null,
  }
}
