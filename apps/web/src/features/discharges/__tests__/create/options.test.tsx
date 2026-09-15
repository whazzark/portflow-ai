import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD } from '../support/fixtures'
import {
  continueTo,
  fillVesselStep,
  mockPreparationOptions,
  renderCreateDischarge,
} from '../support/test-helpers'

test('shows the form at once while each list of choices loads inside its field', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD, delayMs: 400 })

  renderCreateDischarge()

  const vesselName = await screen.findByRole('textbox', { name: 'Vessel name' })
  const dock = screen.getByRole('combobox', { name: 'Dock' })
  expect(dock).toHaveAttribute('aria-busy', 'true')
  expect(dock).toHaveAttribute('placeholder', 'Loading…')

  // The rest of the form is usable meanwhile.
  fireEvent.change(vesselName, { target: { value: 'MV Early Bird' } })
  expect(vesselName).toHaveValue('MV Early Bird')

  await waitFor(() => expect(dock).not.toHaveAttribute('aria-busy', 'true'), { timeout: 3000 })
  await userEvent.type(dock, 'Dock')
  expect(await screen.findAllByRole('option')).not.toHaveLength(0)
})

test('offers a retry inside the field whose choices failed to load', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD, failTimes: 1 })

  renderCreateDischarge()

  await screen.findByRole('textbox', { name: 'Vessel name' })
  await fillVesselStep()
  await continueTo('Product lots')
  const lot = await screen.findByRole('group', { name: 'Customer 1' })
  const retry = await within(lot).findByRole('button', { name: 'Retry loading customer' })
  const customer = within(lot).getByRole('combobox', { name: 'Customer' })
  expect(customer).toHaveAttribute('placeholder', 'Unable to load')
  // Only the failed list asks for a retry: the lot's other fields stay usable.
  expect(within(lot).getByRole('textbox', { name: 'Product name' })).toBeEnabled()

  fireEvent.click(retry)

  await waitFor(() =>
    expect(
      within(lot).queryByRole('button', { name: 'Retry loading customer' }),
    ).not.toBeInTheDocument(),
  )
  await userEvent.type(customer, 'Acme')
  expect(await screen.findByRole('option', { name: 'Acme Logistics' })).toBeInTheDocument()
})

test('names a missing collection and keeps the preparation from moving on', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD, customers: [] })

  renderCreateDischarge()

  expect(await screen.findByText('No available customer')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Next: Product lots' })).toBeDisabled()
})
