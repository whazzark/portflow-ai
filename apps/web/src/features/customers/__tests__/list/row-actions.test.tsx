import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { CustomerDto } from '@/features/customers/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS, OBSERVER } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

const AVAILABLE = CUSTOMERS.find((customer) => customer.status === 'AVAILABLE') as CustomerDto
const ARCHIVED = CUSTOMERS.find((customer) => customer.status === 'ARCHIVED') as CustomerDto

// The menu is portaled out of the table, so its items are queried from `screen` rather than
// through the row — which the directory re-renders underneath them.
async function openRowMenu(name: string, table = 'Available customers') {
  await screen.findByRole('table', { name: table })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

test('offers view, edit, and the lifecycle action from an available row', async () => {
  mockCustomers()
  renderCustomers()

  await openRowMenu(AVAILABLE.companyName)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('offers reactivation, and no edit, from an archived row', async () => {
  mockCustomers()
  renderCustomers('/customers?status=archived')

  await openRowMenu(ARCHIVED.companyName, 'Archived customers')

  expect(screen.getByRole('menuitem', { name: 'Reactivate' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
})

test('leaves a non-administrator with consultation only', async () => {
  mockCustomers(OBSERVER)
  renderCustomers()

  await openRowMenu(AVAILABLE.companyName)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
})

test('archives a customer from its row without opening the detail pane', async () => {
  let received: { comment: string | null } | null = null

  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/${AVAILABLE.id}/archive`, async ({ request }) => {
      received = (await request.json()) as { comment: string | null }
      return HttpResponse.json({ data: { ...AVAILABLE, status: 'ARCHIVED' } })
    }),
  )

  renderCustomers()

  await openRowMenu(AVAILABLE.companyName)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))

  // The confirmation is the one the detail pane uses, down to its comment field.
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByRole('heading', { name: 'Archive customer?' })).toBeInTheDocument()
  fireEvent.change(within(dialog).getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Retired from the row menu' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => expect(received).toEqual({ comment: 'Retired from the row menu' }))
  expect(
    await screen.findByText(`Customer “${AVAILABLE.companyName}” archived`),
  ).toBeInTheDocument()
  // The detail sheet was never opened: the row menu is enough on its own.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
