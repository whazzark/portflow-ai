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
      return HttpResponse.json({
        data: {
          updatedCustomers: CUSTOMERS.map((customer) =>
            customer.status === 'AVAILABLE' ? { ...customer, status: 'ARCHIVED' } : customer,
          ).filter((customer) => customer.status === 'ARCHIVED'),
          blockedCustomers: [],
        },
      })
    }),
  )

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument(),
  )

  const toolbar = screen.getByRole('toolbar', { name: 'Bulk customer actions' })
  expect(within(toolbar).getByText('2 selected')).toBeInTheDocument()
  expect(within(toolbar).getByRole('button', { name: 'Archive selected' })).toHaveTextContent(
    /^Archive$/,
  )
  expect(within(toolbar).getByRole('button', { name: 'Clear selection' })).toHaveTextContent(
    /^Clear$/,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  const selection = within(dialog).getByRole('list', { name: 'Selected customers' })
  const items = within(selection).getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0]).toHaveTextContent('ACME-01')
  expect(items[0]).toHaveTextContent('Acme Logistics')
  expect(items[1]).toHaveTextContent('BETA-02')
  const comment = within(dialog).getByRole('textbox', { name: 'Comment (optional)' })
  expect(comment).toHaveAttribute('maxlength', '1000')
  expect(comment).toHaveAttribute('placeholder', 'Why are these customers archived?')
  fireEvent.change(comment, {
    target: { value: 'Portfolio cleanup' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive 2 customers' }))

  await waitFor(() => {
    expect(requestBody).toEqual({
      ids: ['available-1', 'available-2'],
      comment: 'Portfolio cleanup',
    })
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  })
})
