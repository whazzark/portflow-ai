import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('opens the customer panel when clicking any table cell', async () => {
  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      HttpResponse.json({ data: CUSTOMERS[0] }),
    ),
  )

  renderCustomers()
  fireEvent.click(await screen.findByText('Acme Logistics'))

  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('ACME-01')).toBeInTheDocument()
})
