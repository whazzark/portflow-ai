import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('keeps blocked selections after a mixed archive result', async () => {
  let currentCustomers = CUSTOMERS

  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers`, () =>
      HttpResponse.json({ data: currentCustomers }),
    ),
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, () => {
      currentCustomers = currentCustomers.map((customer) =>
        customer.id === 'available-1' ? { ...customer, status: 'ARCHIVED' } : customer,
      )
      return HttpResponse.json({
        data: {
          updatedCustomers: currentCustomers.filter((customer) => customer.id === 'available-1'),
          blockedCustomers: [
            { id: 'available-2', code: 'BETA-02', companyName: 'Bêta Maritime', reason: 'IN_USE' },
          ],
        },
      })
    }),
  )

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  expect(await screen.findByText('Some customers were unchanged')).toBeInTheDocument()
  expect(screen.getByText(/active or planned/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Available (1)' })).toBeInTheDocument()
  expect(
    within(screen.getByRole('table', { name: 'Available customers' })).getByRole('checkbox', {
      name: 'Select customer BETA-02',
    }),
  ).toBeChecked()
})
