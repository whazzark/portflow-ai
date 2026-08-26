import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('lets administrators inspect and update an available customer in the sheet', async () => {
  const updated = {
    ...CUSTOMERS[0],
    companyName: 'Acme Maritime',
    updatedAt: '2026-01-05T00:00:00.000Z',
  }
  let currentCustomers = CUSTOMERS

  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers`, () =>
      HttpResponse.json({ data: currentCustomers }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/customers/available-1`, () => {
      currentCustomers = currentCustomers.map((customer) =>
        customer.id === updated.id ? updated : customer,
      )
      return HttpResponse.json({ data: updated })
    }),
  )

  renderCustomers()
  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByRole('heading', { name: 'Acme Logistics' })).toBeInTheDocument()
  expect(within(dialog).getByText('ACME-01')).toBeInTheDocument()
  expect(within(dialog).getByText('Created')).toBeInTheDocument()
  expect(within(dialog).getByText('Last updated')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  expect((await within(dialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('heading', { name: 'Edit customer' })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'Back to details' }))
  expect(await screen.findByRole('heading', { name: 'Acme Logistics' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit customer' })).not.toBeInTheDocument()

  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Acme Maritime' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    (await within(screen.getByRole('dialog')).findAllByText('Acme Maritime')).length,
  ).toBeGreaterThan(0)
  expect(screen.getByRole('dialog')).toHaveTextContent('Available')
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
})
