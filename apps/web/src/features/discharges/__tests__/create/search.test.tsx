import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD, AVAILABLE_CUSTOMERS } from '../support/fixtures'
import {
  allowFormJourneyTime,
  continueTo,
  fillVesselStep,
  mockPreparationOptions,
  renderCreateDischarge,
} from '../support/test-helpers'

allowFormJourneyTime()

async function customerField() {
  await screen.findByRole('textbox', { name: 'Vessel name' })
  await fillVesselStep()
  await continueTo('Product lots')
  const lot = await screen.findByRole('group', { name: 'Customer 1' })

  return within(lot).getByRole('combobox', { name: 'Customer' })
}

test('narrows the customers to those matching what is typed, ignoring case and accents', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  renderCreateDischarge()
  const customer = await customerField()

  await waitFor(() => expect(customer).not.toHaveAttribute('aria-busy', 'true'))
  await userEvent.type(customer, 'beta')

  const options = await screen.findAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual(['Bêta Maritime'])
})

test('says so when no customer matches', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  renderCreateDischarge()
  const customer = await customerField()

  await waitFor(() => expect(customer).not.toHaveAttribute('aria-busy', 'true'))
  await userEvent.type(customer, 'zzz')

  expect(await screen.findByText('No customer matches')).toBeInTheDocument()
  expect(screen.queryByRole('option')).not.toBeInTheDocument()
})

test('lists every customer from the open button without typing', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  renderCreateDischarge()
  await customerField()
  const lot = screen.getByRole('group', { name: 'Customer 1' })

  fireEvent.click(await within(lot).findByRole('button', { name: 'Show customer options' }))

  await waitFor(() =>
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      AVAILABLE_CUSTOMERS.map((candidate) => candidate.companyName),
    ),
  )
})
