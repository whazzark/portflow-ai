import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('reactivates selected archived customers', async () => {
  let requestBody: unknown

  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/reactivate`, async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))

  const table = await screen.findByRole('table', { name: 'Archived customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all archived customers' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  await waitFor(() => expect(requestBody).toEqual({ ids: ['archived-1'], comment: null }))
})
