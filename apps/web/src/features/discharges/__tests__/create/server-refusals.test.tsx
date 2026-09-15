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
  productRow,
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

  // The earliest step holding a refused value opens, with its error in place: the second lot is
  // the first product of the second customer block.
  const secondLot = await screen.findByRole('group', { name: 'Customer 2' })
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

test('points a refusal at the product row of a customer holding several lots', async () => {
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({
    respond: () =>
      validationRefusal([
        {
          field: 'productLots.2.expectedQuantityTonnes',
          message: 'This quantity is refused',
          rule: 'range',
        },
      ]),
  })

  await openCreationFromList()
  await fillValidPreparation()
  await goToStep('Product lots')
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Customer 1' })).getByRole('button', {
      name: 'Add product',
    }),
  )
  const added = productRow(1, 2)
  fireEvent.change(within(added).getByRole('textbox', { name: 'Product name' }), {
    target: { value: 'Colza' },
  })
  fireEvent.change(within(added).getByRole('textbox', { name: 'Expected quantity (t)' }), {
    target: { value: '10' },
  })
  await goToStep('Planned shifts')
  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  // Lot 2 (zero-based) is Customer 2's first product, not Customer 1's second one.
  const refused = await screen.findByText('This quantity is refused')
  expect(within(productRow(2, 1)).getByText('This quantity is refused')).toBe(refused)
  expect(within(productRow(1, 2)).queryByText('This quantity is refused')).not.toBeInTheDocument()
})
