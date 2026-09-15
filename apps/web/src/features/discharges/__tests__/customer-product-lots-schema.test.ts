import { expect, test } from 'vitest'

import { buildLot } from '@/features/discharges/__tests__/support/fixtures'
import { groupLotsByCustomer } from '@/features/discharges/discharge-detail-view'
import {
  customerProductLotsCrossRulesSchema,
  customerProductLotsFieldNames,
  customerProductLotsFieldOf,
  customerProductLotsFieldsSchema,
  customerProductLotsFormValues,
  emptyCorrectionLine,
  toCustomerProductLotsBody,
} from '@/features/discharges/discharge-preparation-schema'

const CARGILL = { id: 'customer-cargill', name: 'Cargill France', status: 'AVAILABLE' as const }

const [CARGILL_GROUP] = groupLotsByCustomer([
  buildLot({ id: 'lot-wheat', customer: CARGILL, productName: 'Blé tendre', description: null }),
  buildLot({
    id: 'lot-barley',
    customer: CARGILL,
    productName: 'Orge',
    expectedQuantityTonnes: '300.500',
    description: 'Hold 2',
  }),
])

test("prefills a customer's correction with its lots, in the order the detail lists them", () => {
  expect(customerProductLotsFormValues(CARGILL_GROUP)).toEqual({
    customerId: 'customer-cargill',
    products: [
      {
        lotId: 'lot-wheat',
        productName: 'Blé tendre',
        expectedQuantityTonnes: '1000.000',
        description: '',
      },
      {
        lotId: 'lot-barley',
        productName: 'Orge',
        expectedQuantityTonnes: '300.500',
        description: 'Hold 2',
      },
    ],
    removedProductLotIds: [],
  })
  expect(emptyCorrectionLine()).toEqual({
    lotId: null,
    productName: '',
    expectedQuantityTonnes: '',
    description: '',
  })
})

test('sends rows in order, naming only the lots it corrects', () => {
  expect(
    toCustomerProductLotsBody({
      customerId: 'customer-soufflet',
      products: [
        {
          lotId: 'lot-barley',
          productName: ' Orge ',
          expectedQuantityTonnes: ' 320 ',
          description: '  ',
        },
        {
          lotId: null,
          productName: 'Colza',
          expectedQuantityTonnes: '12.5',
          description: 'Hold 3',
        },
      ],
      removedProductLotIds: ['lot-wheat'],
    }),
  ).toEqual({
    customerId: 'customer-soufflet',
    productLots: [
      { id: 'lot-barley', productName: 'Orge', expectedQuantityTonnes: '320', description: null },
      { productName: 'Colza', expectedQuantityTonnes: '12.5', description: 'Hold 3' },
    ],
    removedProductLotIds: ['lot-wheat'],
  })
})

test('points an API refusal at the row it names, or at the form when it names no field', () => {
  expect(customerProductLotsFieldOf('productLots.2.expectedQuantityTonnes')).toBe(
    'products[2].expectedQuantityTonnes',
  )
  expect(customerProductLotsFieldOf('productLots.0.productName')).toBe('products[0].productName')
  expect(customerProductLotsFieldOf('customerId')).toBe('customerId')
  expect(customerProductLotsFieldOf('removedProductLotIds.0')).toBeNull()
  expect(customerProductLotsFieldOf('productLots.0.id')).toBeNull()

  expect(customerProductLotsFieldNames(customerProductLotsFormValues(CARGILL_GROUP))).toEqual([
    'customerId',
    'products[0].productName',
    'products[0].expectedQuantityTonnes',
    'products[0].description',
    'products[1].productName',
    'products[1].expectedQuantityTonnes',
    'products[1].description',
  ])
})

test('checks each row as a single lot is checked', () => {
  const values = customerProductLotsFormValues(CARGILL_GROUP)
  values.products[1].productName = '  '
  values.products[0].expectedQuantityTonnes = '0'

  const result = customerProductLotsFieldsSchema.safeParse(values)

  expect(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  ).toEqual([
    ['products.0.expectedQuantityTonnes', 'Enter a quantity above 0 with at most 3 decimals'],
    ['products.1.productName', 'Product name is required.'],
  ])
})

const clashPaths = (result: { error?: { issues: Array<{ path: PropertyKey[] }> } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.join('.'))

test("refuses rows sharing a name, or taking a name the customer's other lots have", () => {
  const rules = customerProductLotsCrossRulesSchema([
    { customerId: 'customer-cargill', productName: 'Colza' },
    { customerId: 'customer-soufflet', productName: 'Maïs' },
  ])
  const values = customerProductLotsFormValues(CARGILL_GROUP)

  values.products[0].productName = 'Orge'
  values.products[1].productName = 'Blé tendre'
  expect(rules.safeParse(values).success).toBe(true)

  values.products[1].productName = ' orge '
  expect(clashPaths(rules.safeParse(values))).toEqual([
    'products.0.productName',
    'products.1.productName',
  ])

  values.products[1].productName = 'COLZA'
  expect(clashPaths(rules.safeParse(values))).toEqual(['products.1.productName'])

  values.products[1].productName = 'Maïs'
  expect(rules.safeParse(values).success).toBe(true)
})

test('keeps at least one row when no other customer has a lot on the discharge', () => {
  const values = { ...customerProductLotsFormValues(CARGILL_GROUP), products: [] }

  expect(
    (customerProductLotsCrossRulesSchema([]).safeParse(values).error?.issues ?? []).map((issue) => [
      issue.path.join('.'),
      issue.message,
    ]),
  ).toEqual([['products', 'Add at least one product.']])
  expect(
    customerProductLotsCrossRulesSchema([
      { customerId: 'customer-soufflet', productName: 'Orge' },
    ]).safeParse(values).success,
  ).toBe(true)
})
