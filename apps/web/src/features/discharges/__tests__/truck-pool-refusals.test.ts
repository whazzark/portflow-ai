import { describe, expect, test } from 'vitest'

import { truckRefusals } from '@/features/discharges/truck-pool-refusals'

describe('truckRefusals', () => {
  test('names each refused truck from its position in the submitted list', () => {
    const refusals = truckRefusals(
      {
        code: 'E_VALIDATION_ERROR',
        message: 'Validation failure',
        details: [
          { field: 'truckIds.1', message: 'This truck is no longer available to reserve' },
          { field: 'truckIds.0', message: 'A suspended truck cannot be newly selected' },
        ],
      },
      ['truck-a', 'truck-b'],
    )

    expect(refusals?.byTruck).toEqual(
      new Map([
        ['truck-b', 'This truck is no longer available to reserve'],
        ['truck-a', 'A suspended truck cannot be newly selected'],
      ]),
    )
    expect(refusals?.summary).toEqual([])
  })

  test('keeps a refusal it cannot tie to a submitted truck as a summary', () => {
    const refusals = truckRefusals(
      {
        code: 'E_VALIDATION_ERROR',
        message: 'Validation failure',
        details: [
          { field: 'truckIds', message: 'The truckIds field has duplicate values' },
          { field: 'truckIds.5', message: 'This truck is no longer available to reserve' },
        ],
      },
      ['truck-a'],
    )

    expect(refusals?.byTruck.size).toBe(0)
    expect(refusals?.summary).toEqual([
      'The truckIds field has duplicate values',
      'This truck is no longer available to reserve',
    ])
  })

  test('is not a truck refusal when the error is not a validation error', () => {
    expect(
      truckRefusals({ code: 'E_DISCHARGE_NOT_PLANNED', message: 'Started' }, ['truck-a']),
    ).toBeNull()
  })
})
