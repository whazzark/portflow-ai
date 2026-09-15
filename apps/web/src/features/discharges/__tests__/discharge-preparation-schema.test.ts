import { expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildLot,
  DISCHARGES,
} from '@/features/discharges/__tests__/support/fixtures'
import {
  createDischargeFieldsSchema,
  createDischargeFormDefaults,
  createDischargeSchema,
  creationFieldNames,
  creationStepOf,
  dischargeIdentitySchema,
  emptyPlannedShift,
  emptyProductLot,
  formatShiftDuration,
  identityFormValues,
  isStepComplete,
  nextPlannedShift,
  plannedShiftSchema,
  productLotFormValues,
  productLotSchema,
  stepHasErrors,
  toCreateDischargeBody,
  toIdentityBody,
  toProductLotBody,
} from '@/features/discharges/discharge-preparation-schema'
import { fromDateTimeLocalValue } from '@/helpers/dates'

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

test('starts a creation with one empty lot and one empty shift', () => {
  expect(createDischargeFormDefaults()).toEqual({
    vesselName: '',
    vesselImo: '',
    vesselComment: '',
    dockId: '',
    expectedStartAt: '',
    productLots: [emptyProductLot()],
    shifts: [emptyPlannedShift()],
  })
  expect(emptyPlannedShift()).toEqual({
    plannedStartAt: '',
    plannedEndAt: '',
    responsibleUserId: '',
  })
})

test('requires at least one lot and one shift', () => {
  const values = { ...validIdentity, productLots: [validLot], shifts: [validShift] }

  expect(createDischargeSchema.safeParse(values).success).toBe(true)
  expect(createDischargeSchema.safeParse({ ...values, productLots: [] }).success).toBe(false)
  expect(createDischargeSchema.safeParse({ ...values, shifts: [] }).success).toBe(false)
})

test('builds the creation body with its identity, lots, and shifts', () => {
  const body = toCreateDischargeBody(
    { ...validIdentity, productLots: [validLot], shifts: [validShift] },
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
    productLots: [validLot, { ...validLot, productName: ' WHEAT ' }],
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
    ['productLots.0.productName', 'This customer already has a lot with this product name'],
    ['productLots.1.productName', 'This customer already has a lot with this product name'],
    ['shifts.2.plannedEndAt', 'The planned end must be after the planned start'],
    ['shifts.0.plannedStartAt', 'This shift overlaps another shift'],
    ['shifts.1.plannedStartAt', 'This shift overlaps another shift'],
  ])
})

test('accepts contiguous shifts and leaves cross rules out of the per-field schema', () => {
  const contiguous = {
    ...validIdentity,
    productLots: [validLot],
    shifts: [
      validShift,
      { ...validShift, plannedStartAt: '2026-10-01T14:00', plannedEndAt: '2026-10-01T22:00' },
    ],
  }
  const duplicated = { ...contiguous, productLots: [validLot, validLot] }

  expect(createDischargeSchema.safeParse(contiguous).success).toBe(true)
  expect(createDischargeFieldsSchema.safeParse(duplicated).success).toBe(true)
})

test('lists every field path the creation form renders', () => {
  expect(
    creationFieldNames({
      ...createDischargeFormDefaults(),
      productLots: [emptyProductLot(), emptyProductLot()],
    }),
  ).toEqual([
    'vesselName',
    'vesselImo',
    'vesselComment',
    'dockId',
    'expectedStartAt',
    'productLots[0].customerId',
    'productLots[0].productName',
    'productLots[0].expectedQuantityTonnes',
    'productLots[0].description',
    'productLots[1].customerId',
    'productLots[1].productName',
    'productLots[1].expectedQuantityTonnes',
    'productLots[1].description',
    'shifts[0].plannedStartAt',
    'shifts[0].plannedEndAt',
    'shifts[0].responsibleUserId',
  ])
})

test('states how long a planned shift lasts', () => {
  expect(formatShiftDuration('2026-10-01T06:00', '2026-10-01T14:00')).toBe('8 h')
  expect(formatShiftDuration('2026-10-01T06:00', '2026-10-01T13:30')).toBe('7 h 30')
  expect(formatShiftDuration('2026-10-01T22:00', '2026-10-02T06:15')).toBe('8 h 15')
  expect(formatShiftDuration('2026-10-01T06:00', '2026-10-01T06:45')).toBe('45 min')
})

test('has no length for a missing, empty, or inverted period', () => {
  expect(formatShiftDuration('', '2026-10-01T14:00')).toBe('—')
  expect(formatShiftDuration('2026-10-01T06:00', '')).toBe('—')
  expect(formatShiftDuration('2026-10-01T06:00', '2026-10-01T06:00')).toBe('—')
  expect(formatShiftDuration('2026-10-01T14:00', '2026-10-01T06:00')).toBe('—')
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
  expect(creationStepOf('productLots[1].customerId')).toBe('lots')
  expect(creationStepOf('productLots.1.customerId')).toBe('lots')
  expect(creationStepOf('shifts[0].plannedEndAt')).toBe('shifts')
})

test('finds errors on the fields of one step only', () => {
  const fieldMeta = {
    vesselName: { errors: [] },
    'productLots[0].productName': { errors: ['Product name is required.'] },
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
    productLots: [validLot, { ...validLot, customerId: 'customer-2' }],
  }

  expect(isStepComplete('vessel', createDischargeFormDefaults())).toBe(false)
  expect(isStepComplete('vessel', { ...values, vesselImo: '123' })).toBe(false)
  expect(isStepComplete('vessel', values)).toBe(true)

  expect(isStepComplete('lots', values)).toBe(true)
  expect(isStepComplete('lots', { ...values, productLots: [validLot, validLot] })).toBe(false)
  expect(
    isStepComplete('lots', {
      ...values,
      productLots: [{ ...validLot, expectedQuantityTonnes: '0' }],
    }),
  ).toBe(false)

  // The shifts of a vessel step being checked do not matter, and are still empty here.
  expect(isStepComplete('shifts', values)).toBe(false)
  expect(isStepComplete('shifts', { ...values, shifts: [validShift] })).toBe(true)
})
