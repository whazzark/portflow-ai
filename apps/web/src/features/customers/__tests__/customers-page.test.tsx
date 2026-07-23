import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { CustomerDto } from '@/features/customers/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'

const ADMIN = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
  accessStatus: 'ACTIVE',
}

const OBSERVER = { ...ADMIN, role: 'OBSERVER', email: 'observer@portflow.test' }

const CUSTOMERS = [
  {
    id: 'available-1',
    code: 'ACME-01',
    companyName: 'Acme Logistics',
    status: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  },
  {
    id: 'available-2',
    code: 'BETA-02',
    companyName: 'Bêta Maritime',
    status: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  },
  {
    id: 'archived-1',
    code: 'OLD-03',
    companyName: 'Old Harbor',
    status: 'ARCHIVED',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    archivedAt: '2026-01-02T00:00:00.000Z',
    archivedByUserId: 'admin-1',
    archiveComment: 'No longer used',
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  },
]

function mockCustomers(user = ADMIN, customers = CUSTOMERS) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/customers`, () => HttpResponse.json({ data: customers })),
  )
}

test('renders customers through status tabs with available selected by default', async () => {
  mockCustomers()

  const { router } = renderApp('/customers')

  const available = await screen.findByRole('table', { name: 'Available customers' })

  expect(within(available).getByText('ACME-01')).toBeInTheDocument()
  expect(within(available).getByText('BETA-02')).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Archived customers' })).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Available \(2\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tablist', { name: 'Customer status' })).toHaveAttribute(
    'data-variant',
    'line',
  )
  expect(router.state.location.search).toMatchObject({ status: 'available' })
  expect(screen.getByRole('button', { name: 'Create customer' })).toBeInTheDocument()
})

test('switches status tabs and filters the active customer list', async () => {
  const user = userEvent.setup()
  mockCustomers()

  const { router } = renderApp('/customers')

  await screen.findByRole('table', { name: 'Available customers' })
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))

  expect(await screen.findByRole('table', { name: 'Archived customers' })).toBeInTheDocument()
  expect(screen.queryByText('ACME-01')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ status: 'archived' })

  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'beta')

  expect(
    within(screen.getByRole('table', { name: 'Archived customers' })).getByText(
      'No matching customers',
    ),
  ).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ q: 'beta', status: 'archived' })
})

test('highlights matching code and company text using the customer search normalization', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderApp('/customers')

  await screen.findByRole('table', { name: 'Available customers' })
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'beta')

  expect(document.querySelectorAll('mark')).toHaveLength(2)
  expect(document.querySelectorAll('mark')[0]).toHaveTextContent('BETA')
  expect(document.querySelectorAll('mark')[1]).toHaveTextContent('Bêta')
})

test('sorts each customer table and updates the URL state', async () => {
  const user = userEvent.setup()
  mockCustomers()

  const { router } = renderApp('/customers')

  const available = await screen.findByRole('table', { name: 'Available customers' })
  await user.click(within(available).getByRole('button', { name: /Company name/ }))

  const codes = within(available)
    .getAllByRole('button')
    .filter((button) => ['ACME-01', 'BETA-02'].includes(button.textContent ?? ''))
    .map((button) => button.textContent)

  expect(codes).toEqual(['ACME-01', 'BETA-02'])
  expect(router.state.location.search).toMatchObject({
    availableSort: 'companyName',
    availableOrder: 'asc',
  })
})

test('keeps the customer page read-only for observers', async () => {
  mockCustomers(OBSERVER)

  renderApp('/customers')

  await screen.findByRole('table', { name: 'Available customers' })

  expect(screen.queryByRole('button', { name: 'Create customer' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View customer ACME-01' })).toBeInTheDocument()
})

test('lets administrators inspect and update an available customer in the sheet', async () => {
  const updated = {
    ...CUSTOMERS[0],
    companyName: 'Acme Maritime',
    updatedAt: '2026-01-05T00:00:00.000Z',
  }
  let current = CUSTOMERS[0]

  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      HttpResponse.json({ data: current }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      (() => {
        current = updated

        return HttpResponse.json({ data: updated })
      })(),
    ),
  )

  renderApp('/customers')

  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByRole('heading', { name: 'Acme Logistics' })).toBeInTheDocument()
  expect(within(dialog).getByText('ACME-01')).toBeInTheDocument()
  expect(within(dialog).getByText('Created')).toBeInTheDocument()
  expect(within(dialog).getByText('Last updated')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Edit customer' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Archive customer' })).toBeInTheDocument()
  expect((await within(dialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Edit customer' }))

  const companyField = await screen.findByRole('textbox', { name: 'Company name' })
  fireEvent.change(companyField, { target: { value: 'Acme Maritime' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    (await within(screen.getByRole('dialog')).findAllByText('Acme Maritime')).length,
  ).toBeGreaterThan(0)
  expect(screen.getByRole('dialog')).toHaveTextContent('Available')
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
})

test('opens the customer panel when clicking any table cell', async () => {
  const user = userEvent.setup()
  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      HttpResponse.json({ data: CUSTOMERS[0] }),
    ),
  )

  renderApp('/customers')

  await user.click(await screen.findByText('Acme Logistics'))

  expect(await screen.findByRole('dialog')).toHaveTextContent('ACME-01')
})

test('does not expose customer mutations to observers in the detail sheet', async () => {
  mockCustomers(OBSERVER)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      HttpResponse.json({ data: CUSTOMERS[0] }),
    ),
  )

  renderApp('/customers')

  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))

  const dialog = await screen.findByRole('dialog')
  expect((await within(dialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)
  expect(within(dialog).queryByRole('button', { name: 'Edit customer' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Archive customer' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
})

test('shows the TanStack Start pending page while the customer list loads', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/customers`, async () => {
      await delay(1500)

      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderApp('/customers')

  expect(
    await screen.findByRole('main', { name: 'Loading customers' }, { timeout: 3000 }),
  ).toBeInTheDocument()
  expect(await screen.findByRole('table', { name: 'Available customers' })).toBeInTheDocument()
})

test('shows a retryable error component when the customer list fails', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/customers`, () =>
      HttpResponse.json(
        { error: { code: 'E_CUSTOMERS_UNAVAILABLE', message: 'Unavailable' } },
        { status: 503 },
      ),
    ),
  )

  renderApp('/customers')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load customers')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('archives and reactivates a customer with explicit lifecycle actions', async () => {
  const initialCustomer: CustomerDto = { ...CUSTOMERS[0], status: 'AVAILABLE' }
  let current: CustomerDto = initialCustomer
  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      HttpResponse.json({ data: current }),
    ),
    http.post(`${API_BASE_URL}/api/v1/customers/available-1/archive`, () => {
      current = {
        ...current,
        status: 'ARCHIVED' as const,
        archivedByUserId: 'admin-1',
        archiveComment: 'Retired account',
        archivedAt: '2026-01-05T00:00:00.000Z',
      }

      return HttpResponse.json({ data: current })
    }),
    http.post(`${API_BASE_URL}/api/v1/customers/available-1/reactivate`, () => {
      current = {
        ...current,
        status: 'AVAILABLE' as const,
        archivedByUserId: null,
        archiveComment: null,
        archivedAt: null,
        reactivationComment: 'Returning to operations',
        reactivatedAt: '2026-01-06T00:00:00.000Z',
      }

      return HttpResponse.json({ data: current })
    }),
  )

  renderApp('/customers')
  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))
  const detailsDialog = await screen.findByRole('dialog')
  expect((await within(detailsDialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Archive customer' }))
  const archiveDialog = await screen.findByRole('alertdialog')
  fireEvent.change(within(archiveDialog).getByRole('textbox', { name: 'Comment (optional)' }), {
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

test('archives the visible selected customers with one shared request', async () => {
  const user = userEvent.setup()
  let requestBody: unknown
  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderApp('/customers')

  const table = await screen.findByRole('table', { name: 'Available customers' })
  await user.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.type(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), 'Portfolio cleanup')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(requestBody).toEqual({
    ids: ['available-1', 'available-2'],
    comment: 'Portfolio cleanup',
  })
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('keeps bulk selection scoped to filtered visible customers', async () => {
  const user = userEvent.setup()
  let requestBody: unknown
  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderApp('/customers')
  await screen.findByRole('table', { name: 'Available customers' })
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'beta')

  const table = screen.getByRole('table', { name: 'Available customers' })
  await user.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }))

  expect(requestBody).toEqual({ ids: ['available-2'], comment: null })
})

test('reactivates selected archived customers', async () => {
  const user = userEvent.setup()
  let requestBody: unknown
  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/reactivate`, async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderApp('/customers')
  await screen.findByRole('table', { name: 'Available customers' })
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))

  const table = await screen.findByRole('table', { name: 'Archived customers' })
  await user.click(within(table).getByRole('checkbox', { name: 'Select all archived customers' }))
  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  expect(requestBody).toEqual({ ids: ['archived-1'], comment: null })
})

test('clears the bulk selection from the floating action bar', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderApp('/customers')
  const table = await screen.findByRole('table', { name: 'Available customers' })
  await user.click(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' }))

  expect(screen.getByRole('toolbar')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(
    within(table).getByRole('checkbox', { name: 'Select customer ACME-01' }),
  ).not.toBeChecked()
})
