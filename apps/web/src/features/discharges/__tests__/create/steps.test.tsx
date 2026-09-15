import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD } from '../support/fixtures'
import {
  allowFormJourneyTime,
  continueTo,
  fillValidPreparation,
  fillVesselStep,
  goToStep,
  mockCreateDischarge,
  mockDischarges,
  mockPreparationOptions,
  openCreationFromList,
} from '../support/test-helpers'

allowFormJourneyTime()

function arrange(respond?: NonNullable<Parameters<typeof mockCreateDischarge>[0]>['respond']) {
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({ respond })
}

function stepButton(name: RegExp) {
  const steps = screen.getByRole('navigation', { name: 'Discharge preparation steps' })

  return within(steps).getByRole('button', { name })
}

test('opens on the vessel step alone, with the later steps not yet reachable', async () => {
  arrange()
  await openCreationFromList()

  expect(screen.getByRole('heading', { level: 2, name: 'Vessel and dock' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'Product lots' })).not.toBeInTheDocument()
  expect(stepButton(/Vessel and dock/)).toHaveAttribute('aria-current', 'step')
  expect(stepButton(/Product lots/)).toBeDisabled()
  expect(stepButton(/Planned shifts/)).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next: Product lots' })).toBeDisabled()
})

test('moves on once the step is valid, with the focus on the reached step', async () => {
  arrange()
  await openCreationFromList()
  await fillVesselStep()

  await continueTo('Product lots')

  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 2, name: 'Product lots' })).toHaveFocus(),
  )
  expect(stepButton(/Product lots/)).toHaveAttribute('aria-current', 'step')
  expect(stepButton(/Vessel and dock/)).toBeEnabled()
  expect(stepButton(/Planned shifts/)).toBeDisabled()
})

test('keeps every value when moving back and forth', async () => {
  arrange()
  await openCreationFromList()
  await fillValidPreparation()

  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  await screen.findByRole('heading', { level: 2, name: 'Product lots' })
  expect(
    within(screen.getByRole('group', { name: 'Product lot 2' })).getByRole('textbox', {
      name: 'Product name',
    }),
  ).toHaveValue('Orge')

  await goToStep('Vessel and dock')
  expect(screen.getByRole('textbox', { name: 'Vessel name' })).toHaveValue('MV Created Dawn')

  // Steps already reached stay reachable forward too, without walking through the ones between.
  await goToStep('Planned shifts')
  expect(
    within(screen.getByRole('group', { name: 'Shift 2' })).getByLabelText(/^Planned end/),
  ).toHaveValue('2026-10-01T14:00')
})

test('takes Enter in a field as the next step', async () => {
  arrange()
  await openCreationFromList()
  await fillVesselStep()

  fireEvent.submit(screen.getByRole('textbox', { name: 'Vessel name' }))

  expect(await screen.findByRole('heading', { level: 2, name: 'Product lots' })).toBeInTheDocument()
})

test('returns to the step holding a value the API refused', async () => {
  arrange(() => ({
    status: 422,
    body: {
      error: {
        code: 'E_VALIDATION_ERROR',
        message: 'Validation failure',
        details: [
          {
            field: 'productLots.1.customerId',
            message: 'This customer is no longer available',
            rule: 'availableCustomer',
          },
        ],
      },
    },
  }))
  await openCreationFromList()
  await fillValidPreparation()

  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  expect(await screen.findByRole('heading', { level: 2, name: 'Product lots' })).toBeInTheDocument()
  const secondLot = screen.getByRole('group', { name: 'Product lot 2' })
  expect(
    await within(secondLot).findByText('This customer is no longer available'),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(within(secondLot).getByRole('combobox', { name: 'Customer' })).toHaveFocus(),
  )
})
