import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD } from '../support/fixtures'
import {
  allowFormJourneyTime,
  fillValidPreparation,
  goToStep,
  mockCreateDischarge,
  mockDischarges,
  mockPreparationOptions,
  openCreationFromList,
} from '../support/test-helpers'

allowFormJourneyTime()

function validationRefusal(details: { field: string; message: string; rule: string }[]) {
  return {
    status: 422,
    body: { error: { code: 'E_VALIDATION_ERROR', message: 'Validation failure', details } },
  }
}

test('shows the API refusal under the lot and shift it names, keeping every value', async () => {
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({
    respond: () =>
      validationRefusal([
        {
          field: 'productLots.1.customerId',
          message: 'This customer is no longer available',
          rule: 'availableCustomer',
        },
        {
          field: 'shifts.0.responsibleUserId',
          message: 'This user can no longer be responsible for a shift',
          rule: 'eligibleShiftResponsible',
        },
        { field: 'somewhere.else', message: 'Something unmapped went wrong', rule: 'other' },
      ]),
  })

  await openCreationFromList()
  await fillValidPreparation()
  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  // The earliest step holding a refused value opens, with its error in place.
  const secondLot = await screen.findByRole('group', { name: 'Product lot 2' })
  expect(
    await within(secondLot).findByText('This customer is no longer available'),
  ).toBeInTheDocument()
  expect(screen.getByText(/Something unmapped went wrong/)).toBeInTheDocument()
  expect(within(secondLot).getByRole('textbox', { name: 'Product name' })).toHaveValue('Orge')
  await waitFor(() =>
    expect(within(secondLot).getByRole('combobox', { name: 'Customer' })).toHaveFocus(),
  )

  await goToStep('Planned shifts')
  expect(
    within(screen.getByRole('group', { name: 'Shift 1' })).getByText(
      'This user can no longer be responsible for a shift',
    ),
  ).toBeInTheDocument()
  await goToStep('Vessel and dock')
  expect(screen.getByRole('textbox', { name: 'Vessel name' })).toHaveValue('MV Created Dawn')
})

test('keeps the values after a failure and resubmits the same creation', async () => {
  const sentIds: string[] = []
  let attempts = 0
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({
    onRequest: (body) => sentIds.push(body.id),
    respond: () => {
      attempts += 1

      return attempts === 1 ? 'network-error' : undefined
    },
  })

  await openCreationFromList()
  await fillValidPreparation()
  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  expect(
    await screen.findByText('Unable to create discharge “MV Created Dawn”'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'Shift 2' })).getByLabelText(/^Planned end/),
  ).toHaveValue('2026-10-01T14:00')

  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Created Dawn' }),
  ).toBeInTheDocument()
  expect(sentIds).toHaveLength(2)
  expect(sentIds[1]).toBe(sentIds[0])
})
