import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS, OBSERVER } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('does not expose customer mutations to observers in the detail sheet', async () => {
  mockCustomers(OBSERVER)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      HttpResponse.json({ data: CUSTOMERS[0] }),
    ),
  )

  renderCustomers()
  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))

  const dialog = await screen.findByRole('dialog')
  expect((await within(dialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)
  expect(within(dialog).queryByRole('button', { name: 'Edit customer' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Archive customer' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
})
