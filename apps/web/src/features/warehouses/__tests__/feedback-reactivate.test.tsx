import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { server } from '@/test/msw/server'
import { API_BASE_URL, TWO_DOOR_ARCHIVED_WAREHOUSE, WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const RIVERSIDE = TWO_DOOR_ARCHIVED_WAREHOUSE
const CATALOGUE = [WAREHOUSES[0], RIVERSIDE]
const REACTIVATE_URL = `${API_BASE_URL}/api/v1/warehouses/${RIVERSIDE.id}/reactivate`

async function submitReactivation(user: ReturnType<typeof userEvent.setup>, comment?: string) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${RIVERSIDE.name} (Archived)` }),
  )
  await user.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  if (comment) {
    await user.type(within(dialog).getByRole('textbox'), comment)
  }
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  return dialog
}

function failWith(status: number, error: Record<string, unknown>) {
  server.use(http.post(REACTIVATE_URL, () => HttpResponse.json({ error }, { status })))
}

test('names the warehouse when a reactivation is refused as not found', async () => {
  mockWarehouses(undefined, CATALOGUE)
  failWith(404, { code: 'E_WAREHOUSE_NOT_FOUND', message: 'Warehouse not found' })
  const user = userEvent.setup()
  renderWarehouses()

  await submitReactivation(user)

  expect(
    await screen.findByText(`Unable to reactivate warehouse “${RIVERSIDE.name}”`),
  ).toBeInTheDocument()
  expect(await screen.findByText('Warehouse not found')).toBeInTheDocument()
})

test('distinguishes an already-available refusal', async () => {
  mockWarehouses(undefined, CATALOGUE)
  failWith(409, {
    code: 'E_WAREHOUSE_ALREADY_AVAILABLE',
    message: 'Warehouse is already available',
  })
  const user = userEvent.setup()
  renderWarehouses()

  await submitReactivation(user)

  expect(await screen.findByText('Warehouse is already available')).toBeInTheDocument()
})

// A validation failure's top-level message is only "Validation failure", so the field-level detail
// is the part that tells the administrator what to fix.
test('surfaces the field-level detail of a validation refusal', async () => {
  mockWarehouses(undefined, CATALOGUE)
  failWith(422, {
    code: 'E_VALIDATION_ERROR',
    message: 'Validation failure',
    details: [
      {
        field: 'comment',
        message: 'The comment field must not be greater than 1000 characters',
        rule: 'maxLength',
      },
    ],
  })
  const user = userEvent.setup()
  renderWarehouses()

  await submitReactivation(user, 'Too long')

  expect(
    await screen.findByText('The comment field must not be greater than 1000 characters'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Validation failure')).not.toBeInTheDocument()
})

test('reports a transient failure distinctly', async () => {
  mockWarehouses(undefined, CATALOGUE)
  failWith(503, { code: 'E_SERVICE_UNAVAILABLE', message: 'Something went wrong' })
  const user = userEvent.setup()
  renderWarehouses()

  await submitReactivation(user)

  expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
})

test('keeps the dialog open with the typed comment after a refusal', async () => {
  mockWarehouses(undefined, CATALOGUE)
  failWith(409, {
    code: 'E_WAREHOUSE_ALREADY_AVAILABLE',
    message: 'Warehouse is already available',
  })
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await submitReactivation(user, 'Zone reopened')

  await screen.findByText('Warehouse is already available')
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox')).toHaveValue('Zone reopened')
})

// The refusal that keeps the dialog open is exactly the one that means someone else already
// reactivated the warehouse, so the very next refresh reports it as available. The open dialog
// must stay the reactivation it was opened as: retitling it to "Archive warehouse?" would rewire
// the confirm button to the opposite lifecycle change under the administrator's cursor.
test('keeps a refused dialog on its own direction when the warehouse turns available underneath', async () => {
  let listRequests = 0
  let catalogue = CATALOGUE
  mockWarehouses(undefined, CATALOGUE)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () => {
      listRequests += 1

      return HttpResponse.json({ data: catalogue })
    }),
  )
  failWith(409, {
    code: 'E_WAREHOUSE_ALREADY_AVAILABLE',
    message: 'Warehouse is already available',
  })
  const user = userEvent.setup()
  const { queryClient } = renderWarehouses()

  const dialog = await submitReactivation(user, 'Zone reopened')
  await screen.findByText('Warehouse is already available')

  // Someone else reactivated it and the list refreshes while the refused dialog is still open.
  const requestsBeforeRefresh = listRequests
  catalogue = [WAREHOUSES[0], { ...RIVERSIDE, status: 'AVAILABLE' }]
  await queryClient.invalidateQueries({ queryKey: warehouseQueries.list().queryKey })
  await waitFor(() => expect(listRequests).toBeGreaterThan(requestsBeforeRefresh))

  expect(within(dialog).getByText('Reactivate warehouse?')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})
