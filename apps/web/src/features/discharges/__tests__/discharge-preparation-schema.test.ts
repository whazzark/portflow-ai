import { expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildLot,
  buildShift,
  DISCHARGES,
} from '@/features/discharges/__tests__/support/fixtures'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
  addProductLotsCrossRulesSchema,
  addShiftFormValues,
  addShiftRulesSchema,
  createDischargeFieldsSchema,
  createDischargeFormDefaults,
  createDischargeSchema,
  creationFieldNames,
  creationFieldOf,
  creationStepOf,
  dischargeIdentitySchema,
  emptyLotGroup,
  emptyPlannedShift,
  emptyProductLine,
  emptyProductLot,
  flattenLotGroups,
  formatLocalShiftDuration,
  identityFormValues,
  isStepComplete,
  lotGroupFieldNames,
  lotGroupFieldOf,
  nextPlannedShift,
  plannedShiftSchema,
  productLotFormValues,
  productLotSchema,
  shiftCorrectionFormValues,
  stepHasErrors,
  toAddShiftBody,
  toCreateDischargeBody,
  toIdentityBody,
  toProductLotBody,
  toProductLotsBody,
  toShiftCorrectionBody,
} from '@/features/discharges/discharge-preparation-schema'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/helpers/dates'

const validIdentity = {
  vesselName: 'MV Atlantic Dawn',
  vesselImo: '9321483',
  vesselComment: '',
  dockId: 'dock-1',
  expectedStartAt: '2026-10-01T06:00',
}

const validLot = {
  customerId: 'customer-1',
  productName: 'Wheat',
  expectedQuantityTonnes: '1250.5',
  description: '',
}

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message)
}

test('accepts a complete identity with an empty IMO and comment', () => {
  expect(dischargeIdentitySchema.safeParse(validIdentity).success).toBe(true)
  expect(dischargeIdentitySchema.safeParse({ ...validIdentity, vesselImo: '' }).success).toBe(true)
})

test('refuses a blank vessel name, a missing dock, and a missing or invalid expected start', () => {
  expect(
    messages(dischargeIdentitySchema.safeParse({ ...validIdentity, vesselName: '   ' })),
  ).toEqual(['Vessel name is required.'])
  expect(messages(dischargeIdentitySchema.safeParse({ ...validIdentity, dockId: '' }))).toEqual([
    'Dock is required.',
  ])
  expect(
    messages(dischargeIdentitySchema.safeParse({ ...validIdentity, expectedStartAt: '' })),
  ).toEqual(['Expected start is required.'])
  expect(
    messages(
      dischargeIdentitySchema.safeParse({ ...validIdentity, expectedStartAt: '2026-02-30T06:00' }),
    ),
  ).toEqual(['Enter a valid date and time.'])
})

test('refuses an IMO that is not seven digits', () => {
  for (const vesselImo of ['123', '93214830', 'IMO9321483']) {
    expect(messages(dischargeIdentitySchema.safeParse({ ...validIdentity, vesselImo }))).toEqual([
      'Enter the 7-digit IMO number',
    ])
  }
})

test('accepts strictly positive quantities with at most three decimals', () => {
  for (const expectedQuantityTonnes of ['1', '0.001', ' 1250.5 ', '999999999.999']) {
    expect(productLotSchema.safeParse({ ...validLot, expectedQuantityTonnes }).success).toBe(true)
  }
})

test('refuses zero, negative, over-precise, and malformed quantities', () => {
  for (const expectedQuantityTonnes of ['0', '0.000', '-1', '1.2345', '1,5', 'abc', '1000000000']) {
    expect(messages(productLotSchema.safeParse({ ...validLot, expectedQuantityTonnes }))).toEqual([
      'Enter a quantity above 0 with at most 3 decimals',
    ])
  }

  expect(messages(productLotSchema.safeParse({ ...validLot, expectedQuantityTonnes: '' }))).toEqual(
    ['Expected quantity is required.'],
  )
})

test('refuses a lot without a customer or a product name', () => {
  expect(messages(productLotSchema.safeParse({ ...validLot, customerId: '' }))).toEqual([
    'Customer is required.',
  ])
  expect(messages(productLotSchema.safeParse({ ...validLot, productName: ' ' }))).toEqual([
    'Product name is required.',
  ])
})

test('starts a new lot empty', () => {
  expect(emptyProductLot()).toEqual({
    customerId: '',
    productName: '',
    expectedQuantityTonnes: '',
    description: '',
  })
})

test('turns identity values into the request body', () => {
  expect(
    toIdentityBody({
      ...validIdentity,
      vesselName: '  MV Atlantic Dawn ',
      vesselImo: '  ',
      vesselComment: ' Delayed ',
    }),
  ).toEqual({
    vesselName: 'MV Atlantic Dawn',
    vesselImo: null,
    vesselComment: 'Delayed',
    dockId: 'dock-1',
    expectedStartAt: fromDateTimeLocalValue('2026-10-01T06:00'),
  })
})

test('turns lot values into the request body, keeping the quantity as typed', () => {
  expect(
    toProductLotBody({ ...validLot, productName: ' Wheat ', expectedQuantityTonnes: ' 12.50 ' }),
  ).toEqual({
    customerId: 'customer-1',
    productName: 'Wheat',
    expectedQuantityTonnes: '12.50',
    description: null,
  })
})

test('pre-fills the identity and lot forms from a discharge detail', () => {
  const detail = buildDischargeDetail(DISCHARGES[0], {
    vesselImo: null,
    vesselComment: 'Berth 4',
  })
  const values = identityFormValues(detail)

  expect(values).toMatchObject({
    vesselName: detail.vesselName,
    vesselImo: '',
    vesselComment: 'Berth 4',
    dockId: detail.dock.id,
  })
  expect(fromDateTimeLocalValue(values.expectedStartAt)).not.toBeNull()
  expect(new Date(fromDateTimeLocalValue(values.expectedStartAt) as string).getTime()).toBe(
    new Date(detail.expectedStartAt as string).setSeconds(0, 0),
  )

  const lot = buildLot({ description: null, expectedQuantityTonnes: '1250.500' })
  expect(productLotFormValues(lot)).toEqual({
    customerId: lot.customer.id,
    productName: lot.productName,
    expectedQuantityTonnes: '1250.500',
    description: '',
  })
})

const validShift = {
  plannedStartAt: '2026-10-01T06:00',
  plannedEndAt: '2026-10-01T14:00',
  responsibleUserId: 'responsible-1',
}

test('requires a planned start, a planned end, and a responsible for a shift', () => {
  expect(plannedShiftSchema.safeParse(validShift).success).toBe(true)
  expect(messages(plannedShiftSchema.safeParse({ ...validShift, plannedStartAt: '' }))).toEqual([
    'Planned start is required.',
  ])
  expect(messages(plannedShiftSchema.safeParse({ ...validShift, plannedEndAt: '' }))).toEqual([
    'Planned end is required.',
  ])
  expect(messages(plannedShiftSchema.safeParse({ ...validShift, responsibleUserId: '' }))).toEqual([
    'Responsible is required.',
  ])
})

/** One customer block holding the given lines, each with `validLot`'s values but its product name. */
const block = (customerId: string, ...productNames: string[]) => ({
  customerId,
  products: productNames.map((productName) => ({
    productName,
    expectedQuantityTonnes: validLot.expectedQuantityTonnes,
    description: validLot.description,
  })),
})

test('starts a creation with one empty customer block and one empty shift', () => {
  expect(createDischargeFormDefaults()).toEqual({
    vesselName: '',
    vesselImo: '',
    vesselComment: '',
    dockId: '',
    expectedStartAt: '',
    lotGroups: [emptyLotGroup()],
    shifts: [emptyPlannedShift()],
  })
  expect(emptyLotGroup()).toEqual({ customerId: '', products: [emptyProductLine()] })
  expect(emptyPlannedShift()).toEqual({
    plannedStartAt: '',
    plannedEndAt: '',
    responsibleUserId: '',
  })
})

test('requires a customer block with a customer and a product, and a shift', () => {
  const values = {
    ...validIdentity,
    lotGroups: [block(validLot.customerId, validLot.productName)],
    shifts: [validShift],
  }

  expect(createDischargeSchema.safeParse(values).success).toBe(true)
  expect(createDischargeSchema.safeParse({ ...values, lotGroups: [] }).success).toBe(false)
  expect(
    createDischargeSchema.safeParse({ ...values, lotGroups: [block(validLot.customerId)] }).success,
  ).toBe(false)
  expect(
    createDischargeSchema.safeParse({ ...values, lotGroups: [block('', validLot.productName)] })
      .success,
  ).toBe(false)
  expect(createDischargeSchema.safeParse({ ...values, shifts: [] }).success).toBe(false)
})

test('lists the lots of customer blocks block by block, each with where it was entered', () => {
  const groups = [block('customer-1', 'Wheat', 'Barley'), block('customer-2', 'Corn')]

  expect(
    flattenLotGroups(groups).map((lot) => [
      lot.customerId,
      lot.productName,
      lot.groupIndex,
      lot.productIndex,
    ]),
  ).toEqual([
    ['customer-1', 'Wheat', 0, 0],
    ['customer-1', 'Barley', 0, 1],
    ['customer-2', 'Corn', 1, 0],
  ])
  expect(toProductLotsBody(groups)).toEqual([
    toProductLotBody({ ...validLot, customerId: 'customer-1', productName: 'Wheat' }),
    toProductLotBody({ ...validLot, customerId: 'customer-1', productName: 'Barley' }),
    toProductLotBody({ ...validLot, customerId: 'customer-2', productName: 'Corn' }),
  ])
})

test('points a refusal of a listed lot at its customer block field', () => {
  const groups = [block('customer-1', 'Wheat', 'Barley'), block('customer-2', 'Corn')]

  expect(lotGroupFieldOf('productLots.2.customerId', groups)).toBe('lotGroups[1].customerId')
  expect(lotGroupFieldOf('productLots.1.productName', groups)).toBe(
    'lotGroups[0].products[1].productName',
  )
  expect(lotGroupFieldOf('productLots.2.expectedQuantityTonnes', groups)).toBe(
    'lotGroups[1].products[0].expectedQuantityTonnes',
  )
  expect(lotGroupFieldOf('productLots.3.productName', groups)).toBeNull()
  expect(lotGroupFieldOf('productLots', groups)).toBeNull()
  expect(lotGroupFieldOf('productLots.0.unknown', groups)).toBeNull()

  const values = { ...createDischargeFormDefaults(), lotGroups: groups }
  expect(creationFieldOf('productLots.2.customerId', values)).toBe('lotGroups[1].customerId')
  expect(creationFieldOf('shifts.0.responsibleUserId', values)).toBe('shifts[0].responsibleUserId')
  expect(creationFieldOf('vesselName', values)).toBe('vesselName')
})

test('builds the creation body with its identity, lots, and shifts', () => {
  const body = toCreateDischargeBody(
    {
      ...validIdentity,
      lotGroups: [block(validLot.customerId, validLot.productName)],
      shifts: [validShift],
    },
    'creation-1',
  )

  expect(body).toEqual({
    id: 'creation-1',
    ...toIdentityBody(validIdentity),
    productLots: [toProductLotBody(validLot)],
    shifts: [
      {
        plannedStartAt: fromDateTimeLocalValue('2026-10-01T06:00'),
        plannedEndAt: fromDateTimeLocalValue('2026-10-01T14:00'),
        responsibleUserId: 'responsible-1',
      },
    ],
  })
})

test('reports the rules across lots and shifts where the form shows them', () => {
  const result = createDischargeSchema.safeParse({
    ...validIdentity,
    lotGroups: [
      block('customer-1', 'Wheat', 'Barley'),
      block('customer-2', 'Wheat'),
      block('customer-1', ' WHEAT '),
    ],
    shifts: [
      validShift,
      { ...validShift, plannedStartAt: '2026-10-01T13:00', plannedEndAt: '2026-10-01T20:00' },
      { ...validShift, plannedStartAt: '2026-10-02T08:00', plannedEndAt: '2026-10-02T07:00' },
    ],
  })

  expect(result.success).toBe(false)
  expect(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  ).toEqual([
    ['lotGroups.2.customerId', 'This customer is already listed above'],
    [
      'lotGroups.0.products.0.productName',
      'This customer already has a lot with this product name',
    ],
    [
      'lotGroups.2.products.0.productName',
      'This customer already has a lot with this product name',
    ],
    ['shifts.2.plannedEndAt', 'The planned end must be after the planned start'],
    ['shifts.0.plannedStartAt', 'This shift overlaps another shift'],
    ['shifts.1.plannedStartAt', 'This shift overlaps another shift'],
  ])
})

test('accepts contiguous shifts and leaves cross rules out of the per-field schema', () => {
  const contiguous = {
    ...validIdentity,
    lotGroups: [block(validLot.customerId, validLot.productName)],
    shifts: [
      validShift,
      { ...validShift, plannedStartAt: '2026-10-01T14:00', plannedEndAt: '2026-10-01T22:00' },
    ],
  }
  const duplicated = {
    ...contiguous,
    lotGroups: [block(validLot.customerId, validLot.productName, validLot.productName)],
  }

  expect(createDischargeSchema.safeParse(contiguous).success).toBe(true)
  expect(createDischargeFieldsSchema.safeParse(duplicated).success).toBe(true)
})

test('lists every field path the creation form renders', () => {
  expect(
    creationFieldNames({
      ...createDischargeFormDefaults(),
      lotGroups: [
        { customerId: '', products: [emptyProductLine(), emptyProductLine()] },
        emptyLotGroup(),
      ],
    }),
  ).toEqual([
    'vesselName',
    'vesselImo',
    'vesselComment',
    'dockId',
    'expectedStartAt',
    'lotGroups[0].customerId',
    'lotGroups[0].products[0].productName',
    'lotGroups[0].products[0].expectedQuantityTonnes',
    'lotGroups[0].products[0].description',
    'lotGroups[0].products[1].productName',
    'lotGroups[0].products[1].expectedQuantityTonnes',
    'lotGroups[0].products[1].description',
    'lotGroups[1].customerId',
    'lotGroups[1].products[0].productName',
    'lotGroups[1].products[0].expectedQuantityTonnes',
    'lotGroups[1].products[0].description',
    'shifts[0].plannedStartAt',
    'shifts[0].plannedEndAt',
    'shifts[0].responsibleUserId',
  ])
})

test('lists the fields of customer blocks alone, for lots added to a discharge', () => {
  expect(lotGroupFieldNames([emptyLotGroup()])).toEqual([
    'lotGroups[0].customerId',
    'lotGroups[0].products[0].productName',
    'lotGroups[0].products[0].expectedQuantityTonnes',
    'lotGroups[0].products[0].description',
  ])
})

test("refuses added lots clashing with each other or with the discharge's existing lots", () => {
  const rules = addProductLotsCrossRulesSchema([{ customerId: 'customer-1', productName: 'Wheat' }])

  const result = rules.safeParse({
    lotGroups: [block('customer-1', ' wheat ', 'Corn', 'corn'), block('customer-2', 'Wheat')],
  })

  expect((result.error?.issues ?? []).map((issue) => issue.path.join('.'))).toEqual([
    'lotGroups.0.products.0.productName',
    'lotGroups.0.products.1.productName',
    'lotGroups.0.products.2.productName',
  ])
  expect(rules.safeParse({ lotGroups: [block('customer-2', 'Wheat')] }).success).toBe(true)
})

test('states how long a planned shift lasts', () => {
  expect(formatLocalShiftDuration('2026-10-01T06:00', '2026-10-01T14:00')).toBe('8 h')
  expect(formatLocalShiftDuration('2026-10-01T06:00', '2026-10-01T13:30')).toBe('7 h 30 min')
  expect(formatLocalShiftDuration('2026-10-01T22:00', '2026-10-02T06:15')).toBe('8 h 15 min')
  expect(formatLocalShiftDuration('2026-10-01T06:00', '2026-10-01T06:45')).toBe('45 min')
})

test('has no length for a missing, empty, or inverted period', () => {
  expect(formatLocalShiftDuration('', '2026-10-01T14:00')).toBe('—')
  expect(formatLocalShiftDuration('2026-10-01T06:00', '')).toBe('—')
  expect(formatLocalShiftDuration('2026-10-01T06:00', '2026-10-01T06:00')).toBe('—')
  expect(formatLocalShiftDuration('2026-10-01T14:00', '2026-10-01T06:00')).toBe('—')
})

test('starts the next shift when the last one ends, for as long', () => {
  expect(
    nextPlannedShift({
      plannedStartAt: '2026-10-01T22:00',
      plannedEndAt: '2026-10-02T06:00',
      responsibleUserId: 'responsible-1',
    }),
  ).toEqual({
    plannedStartAt: '2026-10-02T06:00',
    plannedEndAt: '2026-10-02T14:00',
    responsibleUserId: '',
  })
})

test('starts an empty shift after an incomplete or inverted one', () => {
  expect(nextPlannedShift(undefined)).toEqual(emptyPlannedShift())
  expect(
    nextPlannedShift({
      plannedStartAt: '2026-10-01T06:00',
      plannedEndAt: '',
      responsibleUserId: '',
    }),
  ).toEqual(emptyPlannedShift())
  expect(
    nextPlannedShift({
      plannedStartAt: '2026-10-01T14:00',
      plannedEndAt: '2026-10-01T06:00',
      responsibleUserId: '',
    }),
  ).toEqual(emptyPlannedShift())
})

test('tells which step a field belongs to', () => {
  expect(creationStepOf('vesselName')).toBe('vessel')
  expect(creationStepOf('dockId')).toBe('vessel')
  expect(creationStepOf('lotGroups[1].customerId')).toBe('lots')
  expect(creationStepOf('lotGroups[0].products[1].productName')).toBe('lots')
  expect(creationStepOf('productLots.1.customerId')).toBe('lots')
  expect(creationStepOf('shifts[0].plannedEndAt')).toBe('shifts')
})

test('finds errors on the fields of one step only', () => {
  const fieldMeta = {
    vesselName: { errors: [] },
    'lotGroups[0].products[0].productName': { errors: ['Product name is required.'] },
    'shifts[0].plannedStartAt': { errors: [undefined] },
  }

  expect(stepHasErrors('vessel', fieldMeta)).toBe(false)
  expect(stepHasErrors('lots', fieldMeta)).toBe(true)
  expect(stepHasErrors('shifts', fieldMeta)).toBe(false)
})

test('holds a step complete only once its own values are valid', () => {
  const values = {
    ...createDischargeFormDefaults(),
    ...validIdentity,
    lotGroups: [block('customer-1', 'Wheat'), block('customer-2', 'Wheat')],
  }

  expect(isStepComplete('vessel', createDischargeFormDefaults())).toBe(false)
  expect(isStepComplete('vessel', { ...values, vesselImo: '123' })).toBe(false)
  expect(isStepComplete('vessel', values)).toBe(true)

  expect(isStepComplete('lots', values)).toBe(true)
  expect(
    isStepComplete('lots', {
      ...values,
      lotGroups: [block('customer-1', 'Wheat'), block('customer-1', 'Barley')],
    }),
  ).toBe(false)
  expect(
    isStepComplete('lots', {
      ...values,
      lotGroups: [
        {
          customerId: 'customer-1',
          products: [{ productName: 'Wheat', expectedQuantityTonnes: '0', description: '' }],
        },
      ],
    }),
  ).toBe(false)

  // The shifts of a vessel step being checked do not matter, and are still empty here.
  expect(isStepComplete('shifts', values)).toBe(false)
  expect(isStepComplete('shifts', { ...values, shifts: [validShift] })).toBe(true)
})

test('sends a period bound left unchanged as the shift holds it, to the second', () => {
  const shift = buildShift({
    plannedStartAt: '2026-10-04T06:00:30.000Z',
    plannedEndAt: '2026-10-04T14:00:30.000Z',
  })
  const values = shiftCorrectionFormValues(shift)

  expect(toShiftCorrectionBody(values, shift)).toMatchObject({
    plannedStartAt: '2026-10-04T06:00:30.000Z',
    plannedEndAt: '2026-10-04T14:00:30.000Z',
  })

  const moved = toShiftCorrectionBody({ ...values, plannedEndAt: '2026-10-05T01:15' }, shift)
  expect(moved.plannedStartAt).toBe('2026-10-04T06:00:30.000Z')
  expect(moved.plannedEndAt).toBe(fromDateTimeLocalValue('2026-10-05T01:15'))
})

test('starts an added shift where the last shift ends, for as long, with nothing chosen', () => {
  const values = addShiftFormValues({
    shifts: [
      buildShift({
        plannedStartAt: '2026-10-04T06:00:00.000Z',
        plannedEndAt: '2026-10-04T14:00:00.000Z',
      }),
    ],
  })

  expect(values).toEqual({
    plannedStartAt: toDateTimeLocalValue('2026-10-04T14:00:00.000Z'),
    plannedEndAt: toDateTimeLocalValue('2026-10-04T22:00:00.000Z'),
    responsibleUserId: '',
    truckIds: [],
    warehouseDoorIds: [],
    weighingAreaIds: [],
  })
  expect(addShiftFormValues({ shifts: [] })).toMatchObject({ plannedStartAt: '', plannedEndAt: '' })
})

const addRuleIssues = (
  shifts: ReturnType<typeof buildShift>[],
  plannedStartAt: string,
  plannedEndAt: string,
  addedId?: string,
) => {
  const result = addShiftRulesSchema(shifts, addedId).safeParse({
    plannedStartAt: toDateTimeLocalValue(plannedStartAt),
    plannedEndAt: toDateTimeLocalValue(plannedEndAt),
    responsibleUserId: 'lead-1',
    truckIds: [],
    warehouseDoorIds: [],
    weighingAreaIds: [],
  })

  return result.success
    ? []
    : result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
}

test('refuses an added period that is inverted or overlaps a shift, naming that shift', () => {
  const planned = buildShift({
    plannedStartAt: '2026-10-04T06:00:00.000Z',
    plannedEndAt: '2026-10-04T14:00:00.000Z',
  })

  expect(addRuleIssues([planned], '2026-10-04T20:00:00.000Z', '2026-10-04T18:00:00.000Z')).toEqual([
    ['plannedEndAt', 'The planned end must be after the planned start'],
  ])
  expect(addRuleIssues([planned], '2026-10-04T10:00:00.000Z', '2026-10-04T18:00:00.000Z')).toEqual([
    ['plannedStartAt', `This shift overlaps shift ${formatShiftPeriod(planned)}`],
  ])
  expect(addRuleIssues([planned], '2026-10-04T14:00:00.000Z', '2026-10-04T22:00:00.000Z')).toEqual(
    [],
  )
})

test('refuses an added shift starting before the shift that started last', () => {
  const started = buildShift({
    id: 'started',
    status: 'ACTIVE',
    plannedStartAt: '2026-10-04T06:00:00.000Z',
    plannedEndAt: '2026-10-04T14:00:00.000Z',
  })
  const planned = buildShift({
    id: 'planned',
    plannedStartAt: '2026-10-05T06:00:00.000Z',
    plannedEndAt: '2026-10-05T14:00:00.000Z',
  })

  expect(
    addRuleIssues([started, planned], '2026-10-03T06:00:00.000Z', '2026-10-03T14:00:00.000Z'),
  ).toEqual([
    ['plannedStartAt', `A new shift must start after shift ${formatShiftPeriod(started)}`],
  ])
  // Between the active shift's end and the next planned shift is fine.
  expect(
    addRuleIssues([started, planned], '2026-10-04T14:00:00.000Z', '2026-10-04T22:00:00.000Z'),
  ).toEqual([])
})

test('sends resources with an added shift only on a planned discharge', () => {
  const values = {
    plannedStartAt: '2026-10-04T14:00',
    plannedEndAt: '2026-10-04T22:00',
    responsibleUserId: 'lead-1',
    truckIds: ['truck-a'],
    warehouseDoorIds: ['door-a'],
    weighingAreaIds: ['area-a'],
  }

  expect(toAddShiftBody(values, 'shift-new', 'PLANNED')).toEqual({
    id: 'shift-new',
    plannedStartAt: fromDateTimeLocalValue('2026-10-04T14:00'),
    plannedEndAt: fromDateTimeLocalValue('2026-10-04T22:00'),
    responsibleUserId: 'lead-1',
    truckIds: ['truck-a'],
    warehouseDoorIds: ['door-a'],
    weighingAreaIds: ['area-a'],
  })
  expect(toAddShiftBody(values, 'shift-new', 'ACTIVE')).toEqual({
    id: 'shift-new',
    plannedStartAt: fromDateTimeLocalValue('2026-10-04T14:00'),
    plannedEndAt: fromDateTimeLocalValue('2026-10-04T22:00'),
    responsibleUserId: 'lead-1',
  })
})

test('leaves out the shift the addition already saved, so its retry is judged by the API', () => {
  const saved = buildShift({
    id: 'added-1',
    plannedStartAt: '2026-10-04T06:00:00.000Z',
    plannedEndAt: '2026-10-04T14:00:00.000Z',
  })

  expect(
    addRuleIssues([saved], '2026-10-04T06:00:00.000Z', '2026-10-04T14:00:00.000Z', 'added-1'),
  ).toEqual([])
  expect(addRuleIssues([saved], '2026-10-04T06:00:00.000Z', '2026-10-04T14:00:00.000Z')).toEqual([
    ['plannedStartAt', `This shift overlaps shift ${formatShiftPeriod(saved)}`],
  ])
})
