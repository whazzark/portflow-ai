import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'

import { throwPreparationIssues } from '#discharges/shared/discharge_preparation_issues'
import {
  findDuplicateLotIssues,
  findLotIdentityClash,
  findPreparationIssues,
  orderShifts,
} from '#discharges/shared/discharge_preparation_rules'

test.group('Discharge preparation issues', () => {
  test('does nothing when there is no issue', ({ assert }) => {
    assert.doesNotThrow(() => throwPreparationIssues([]))
  })

  test('raises the validation error shape the exception handler answers with', ({ assert }) => {
    const issues = [
      { field: 'dockId', rule: 'availableDock', message: 'The dock is no longer available' },
      {
        field: 'productLots.1.productName',
        rule: 'productLotIdentityUnique',
        message: 'This customer already has a lot with this product name',
      },
    ]

    try {
      throwPreparationIssues(issues)
      assert.fail('expected the issues to be thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const validationError = error as InstanceType<typeof errors.E_VALIDATION_ERROR>
      assert.equal(validationError.status, 422)
      assert.equal(validationError.code, 'E_VALIDATION_ERROR')
      assert.deepEqual(validationError.messages, issues)
    }
  })
})

test.group('Discharge preparation shift order', () => {
  const at = (iso: string) => DateTime.fromISO(iso, { setZone: true })

  test('numbers shifts entered out of order by planned start', ({ assert }) => {
    const ordered = orderShifts([
      { name: 'afternoon', plannedStartAt: at('2026-10-01T14:00:00Z') },
      { name: 'night', plannedStartAt: at('2026-10-01T22:00:00Z') },
      { name: 'morning', plannedStartAt: at('2026-10-01T06:00:00Z') },
    ])

    assert.deepEqual(
      ordered.map((shift) => [shift.sequence, shift.name]),
      [
        [1, 'morning'],
        [2, 'afternoon'],
        [3, 'night'],
      ],
    )
  })

  test('keeps already ordered shifts and a single shift as they are', ({ assert }) => {
    const single = orderShifts([{ name: 'only', plannedStartAt: at('2026-10-01T06:00:00Z') }])
    const ordered = orderShifts([
      { name: 'first', plannedStartAt: at('2026-10-01T06:00:00Z') },
      { name: 'second', plannedStartAt: at('2026-10-01T14:00:00Z') },
    ])

    assert.deepEqual(
      single.map((shift) => [shift.sequence, shift.name]),
      [[1, 'only']],
    )
    assert.deepEqual(
      ordered.map((shift) => [shift.sequence, shift.name]),
      [
        [1, 'first'],
        [2, 'second'],
      ],
    )
  })
})

test.group('Discharge preparation rules', () => {
  const at = (iso: string) => DateTime.fromISO(iso, { setZone: true })
  const lot = (customerId: string, productName: string) => ({ customerId, productName })
  const shift = (start: string, end: string) => ({
    plannedStartAt: at(`2026-10-01T${start}:00Z`),
    plannedEndAt: at(`2026-10-01T${end}:00Z`),
  })
  const fieldsAndRules = (issues: { field: string; rule: string }[]) =>
    issues.map((issue) => [issue.field, issue.rule])

  test('finds no issue in a coherent preparation', ({ assert }) => {
    const issues = findPreparationIssues({
      productLots: [
        lot('customer-a', 'Wheat'),
        lot('customer-b', 'Wheat'),
        lot('customer-a', 'Barley'),
      ],
      shifts: [shift('06:00', '14:00'), shift('14:00', '22:00')],
    })

    assert.deepEqual(issues, [])
  })

  test('rejects two lots of one customer with the same product name, ignoring case and spaces', ({
    assert,
  }) => {
    const issues = findPreparationIssues({
      productLots: [lot('customer-a', 'Wheat'), lot('customer-a', ' wheat ')],
      shifts: [shift('06:00', '14:00')],
    })

    assert.deepEqual(fieldsAndRules(issues), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
      ['productLots.1.productName', 'productLotIdentityUnique'],
    ])
  })

  test('finds duplicate lots of a batch on their own, at each position', ({ assert }) => {
    const issues = findDuplicateLotIssues([
      lot('customer-a', 'Wheat'),
      lot('customer-b', 'Wheat'),
      lot('CUSTOMER-A', ' WHEAT'),
    ])

    assert.deepEqual(fieldsAndRules(issues), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
      ['productLots.2.productName', 'productLotIdentityUnique'],
    ])
  })

  test('rejects a shift whose planned end is not after its planned start', ({ assert }) => {
    const issues = findPreparationIssues({
      productLots: [lot('customer-a', 'Wheat')],
      shifts: [shift('14:00', '14:00'), shift('20:00', '16:00')],
    })

    assert.deepEqual(fieldsAndRules(issues), [
      ['shifts.0.plannedEndAt', 'shiftPeriodOrder'],
      ['shifts.1.plannedEndAt', 'shiftPeriodOrder'],
    ])
  })

  test('rejects overlapping shifts and reports each shift once', ({ assert }) => {
    const pair = findPreparationIssues({
      productLots: [lot('customer-a', 'Wheat')],
      shifts: [shift('06:00', '14:00'), shift('13:00', '22:00')],
    })
    const triple = findPreparationIssues({
      productLots: [lot('customer-a', 'Wheat')],
      shifts: [shift('06:00', '14:00'), shift('07:00', '15:00'), shift('08:00', '16:00')],
    })

    assert.deepEqual(fieldsAndRules(pair), [
      ['shifts.0.plannedStartAt', 'shiftOverlap'],
      ['shifts.1.plannedStartAt', 'shiftOverlap'],
    ])
    assert.deepEqual(fieldsAndRules(triple), [
      ['shifts.0.plannedStartAt', 'shiftOverlap'],
      ['shifts.1.plannedStartAt', 'shiftOverlap'],
      ['shifts.2.plannedStartAt', 'shiftOverlap'],
    ])
  })

  test('finds a lot identity clash against existing lots, ignoring the lot being corrected', ({
    assert,
  }) => {
    const existing = [
      { id: 'lot-1', customerId: 'customer-a', productName: 'Wheat' },
      { id: 'lot-2', customerId: 'customer-b', productName: 'Barley' },
    ]

    assert.isTrue(findLotIdentityClash(existing, lot('customer-a', ' WHEAT ')))
    assert.isFalse(findLotIdentityClash(existing, lot('customer-b', 'Wheat')))
    assert.isFalse(findLotIdentityClash(existing, lot('customer-a', 'wheat'), 'lot-1'))
    assert.isTrue(findLotIdentityClash(existing, lot('customer-b', 'barley'), 'lot-1'))
  })
})
