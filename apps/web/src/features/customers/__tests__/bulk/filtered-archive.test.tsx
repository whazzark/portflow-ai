import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('keeps bulk selection scoped to filtered visible customers', async () => {
  let requestBody: unknown

  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({
        data: {
          updatedCustomers: CUSTOMERS.filter((customer) => customer.id === 'available-2'),
          blockedCustomers: [],
        },
      })
    }),
  )

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Search customers' }), {
    target: { value: 'beta' },
  })
  await waitFor(() => expect(screen.queryByText('ACME-01')).not.toBeInTheDocument())

  const table = screen.getByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  await waitFor(() => expect(requestBody).toEqual({ ids: ['available-2'], comment: null }))
})
