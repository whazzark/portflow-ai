import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  API_BASE_URL,
  ARCHIVED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
  WAREHOUSES_WITH_ARCHIVED_DOOR,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'
import { server } from '@/test/msw/server'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const AVAILABLE = WAREHOUSES[0]
const DOOR = (AVAILABLE.doors ?? [])[0]
const BULK_URL = `${API_BASE_URL}/api/v1/warehouse-doors/archive`
const path = `/warehouses?status=all&warehouseId=${AVAILABLE.id}`

type Outcome = {
  updatedDoors: unknown[]
  blockedDoors: Array<{ id: string; name?: string; reason: string }>
}

function mockBulkArchive(outcome: Outcome, options: { status?: number } = {}) {
  const captured: { body?: { ids: string[]; comment: string | null } } = {}
  let submitted = false

  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
      HttpResponse.json({
        data:
          submitted && outcome.updatedDoors.length > 0 ? WAREHOUSES_WITH_ARCHIVED_DOOR : WAREHOUSES,
      }),
    ),
    http.post(BULK_URL, async ({ request }) => {
      captured.body = (await request.json()) as { ids: string[]; comment: string | null }
      submitted = true

      return options.status
        ? HttpResponse.json(
            { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
            { status: options.status },
          )
        : HttpResponse.json({ data: outcome })
    }),
  )

  return captured
}

async function selectDoorAndSubmit(user: ReturnType<typeof userEvent.setup>, comment?: string) {
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await user.click(await screen.findByRole('button', { name: 'Archive selected' }))

  const dialog = await screen.findByRole('alertdialog')
  if (comment) {
    await user.type(within(dialog).getByRole('textbox'), comment)
  }
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  return dialog
}

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

test('shows the action beside Select all only once a door is checked', async () => {
  const user = userEvent.setup()
  renderWarehouses(path)

  await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` })
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` }))

  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('counts the selection in the confirmation and sends one comment for it', async () => {
  const captured = mockBulkArchive({ updatedDoors: [ARCHIVED_DOOR], blockedDoors: [] })
  const user = userEvent.setup()
  renderWarehouses(path)

  await selectDoorAndSubmit(user, 'North side condemned')

  expect(await screen.findByText('1 door archived')).toBeInTheDocument()
  expect(captured.body).toMatchObject({
    ids: [DOOR.id],
    comment: 'North side condemned',
  })
})

test('reports a partial outcome with one reason per unchanged door', async () => {
  mockBulkArchive({
    updatedDoors: [ARCHIVED_DOOR],
    blockedDoors: [
      { id: 'blocked-1', name: 'Door 3', reason: 'IN_USE' },
      { id: 'blocked-2', name: 'Door 4', reason: 'ALREADY_ARCHIVED' },
    ],
  })
  const user = userEvent.setup()
  renderWarehouses(path)

  await selectDoorAndSubmit(user)

  expect(await screen.findByText('1 door archived; 2 doors unchanged')).toBeInTheDocument()
  // The shared default labels read true for a door, which is why this feature overrides none.
  expect(
    await screen.findByText(/Door 3: used by an active or planned discharge/),
  ).toBeInTheDocument()
  expect(await screen.findByText(/Door 4: already archived/)).toBeInTheDocument()
})

test('reports that nothing changed when every door is blocked', async () => {
  mockBulkArchive({
    updatedDoors: [],
    blockedDoors: [{ id: 'blocked-1', name: 'Door 3', reason: 'IN_USE' }],
  })
  const user = userEvent.setup()
  renderWarehouses(path)

  await selectDoorAndSubmit(user)

  expect(await screen.findByText('1 door unchanged')).toBeInTheDocument()
})

test('keeps only the in-use doors checked, so they can be retried', async () => {
  // Nothing archived here on purpose: the door that stays checked has to stay *listed*, and the
  // Available view only lists it while it is still available.
  mockBulkArchive({
    updatedDoors: [],
    blockedDoors: [
      { id: DOOR.id, name: DOOR.name, reason: 'IN_USE' },
      { id: 'blocked-2', name: 'Door 4', reason: 'ALREADY_ARCHIVED' },
    ],
  })
  const user = userEvent.setup()
  renderWarehouses(path)

  await selectDoorAndSubmit(user)

  await screen.findByText(/unchanged/)
  // The in-use door stays checked, so the action stays offered for a retry.
  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).toBeChecked()
})

test('keeps the dialog, the selection, and the comment after a refused request', async () => {
  mockBulkArchive({ updatedDoors: [], blockedDoors: [] }, { status: 500 })
  const user = userEvent.setup()
  renderWarehouses(path)

  const dialog = await selectDoorAndSubmit(user, 'North side condemned')

  expect(await screen.findByText('Unable to archive doors')).toBeInTheDocument()
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox')).toHaveValue('North side condemned')
  // The selection is intact — the dialog still counts the door it was opened for. Asserted from
  // inside the dialog because the modal hides the panel's checkboxes from role queries.
  expect(dialog).toHaveTextContent('1 door remains readable')
})

test('withdraws the action when the last checked door is unchecked', async () => {
  const user = userEvent.setup()
  renderWarehouses(path)

  const checkbox = await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` })
  await user.click(checkbox)
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(checkbox)

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})
