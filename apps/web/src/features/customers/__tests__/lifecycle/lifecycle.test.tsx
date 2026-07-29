import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { CustomerDto } from '@/features/customers/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('archives and reactivates a customer with explicit lifecycle actions', async () => {
  const initialCustomer: CustomerDto = { ...CUSTOMERS[0], status: 'AVAILABLE' }
  let current: CustomerDto = initialCustomer
  let currentCustomers = CUSTOMERS.map((customer) =>
    customer.id === initialCustomer.id ? initialCustomer : customer,
  )

  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers`, () =>
      HttpResponse.json({ data: currentCustomers }),
    ),
    http.post(`${API_BASE_URL}/api/v1/customers/available-1/archive`, () => {
      current = {
        ...current,
        status: 'ARCHIVED',
        archivedByUserId: 'admin-1',
        archiveComment: 'Retired account',
        archivedAt: '2026-01-05T00:00:00.000Z',
      }
      currentCustomers = currentCustomers.map((customer) =>
        customer.id === current.id ? current : customer,
      )
      return HttpResponse.json({ data: current })
    }),
    http.post(`${API_BASE_URL}/api/v1/customers/available-1/reactivate`, () => {
      current = {
        ...current,
        status: 'AVAILABLE',
        archivedByUserId: null,
        archiveComment: null,
        archivedAt: null,
        reactivationComment: 'Returning to operations',
        reactivatedAt: '2026-01-06T00:00:00.000Z',
      }
      currentCustomers = currentCustomers.map((customer) =>
        customer.id === current.id ? current : customer,
      )
      return HttpResponse.json({ data: current })
    }),
  )

  renderCustomers()
  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))
  const detailsDialog = await screen.findByRole('dialog')
  expect((await within(detailsDialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Archive customer' }))
  const archiveDialog = await screen.findByRole('alertdialog')
  const comment = within(archiveDialog).getByRole('textbox', { name: 'Comment (optional)' })
  expect(comment).toHaveAttribute('maxlength', '1000')
  fireEvent.change(comment, {
    target: { value: 'Retired account' },
  })
  fireEvent.click(within(archiveDialog).getByRole('button', { name: 'Archive' }))

  expect((await within(detailsDialog).findAllByText('Archived')).length).toBeGreaterThan(0)
  expect(await within(detailsDialog).findByText('Lifecycle')).toBeInTheDocument()
  expect(within(detailsDialog).getByText('Archive comment')).toBeInTheDocument()
  expect(
    within(detailsDialog).queryByRole('button', { name: 'Edit customer' }),
  ).not.toBeInTheDocument()
  expect(
    await within(detailsDialog).findByRole('button', { name: 'Reactivate customer' }),
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Reactivate customer' }))
  const reactivateDialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(reactivateDialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Available')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
})
