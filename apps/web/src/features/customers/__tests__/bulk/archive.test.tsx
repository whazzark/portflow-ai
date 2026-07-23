import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('archives the visible selected customers with one shared request', async () => {
  let requestBody: unknown

  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), {
    target: { value: 'Portfolio cleanup' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => {
    expect(requestBody).toEqual({
      ids: ['available-1', 'available-2'],
      comment: 'Portfolio cleanup',
    })
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  })
})
