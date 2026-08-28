import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import {
  API_BASE_URL,
  REACTIVATE_WAREHOUSES,
  TWO_DOOR_ARCHIVED_WAREHOUSE,
} from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const AVAILABLE = REACTIVATE_WAREHOUSES[0]
const RIVERSIDE = REACTIVATE_WAREHOUSES[1]
const RETIRED = REACTIVATE_WAREHOUSES[2]
const BULK_URL = `${API_BASE_URL}/api/v1/warehouses/reactivate`

async function checkWarehouses(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  for (const name of names) {
    await user.click(await screen.findByRole('button', { name: `Select warehouse ${name}` }))
  }
}

async function openBulkDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))

  return screen.findByRole('alertdialog')
}

test('offers a reactivation action once archived warehouses are selected', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name, RETIRED.name)

  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(screen.getByText('2 selected')).toBeInTheDocument()
})

test('sums the doors returning to service across the whole selection', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  // Riverside Shed restores both of its doors, Retired Shed its one.
  await checkWarehouses(user, RIVERSIDE.name, RETIRED.name)
  const dialog = await openBulkDialog(user)

  expect(dialog).toHaveTextContent('These 2 warehouses')
  expect(dialog).toHaveTextContent('Their 3 doors return to service')
})

test('reactivates a fully eligible selection and reports the count', async () => {
  let capturedBody: unknown
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  server.use(
    http.post(BULK_URL, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: {
          updatedWarehouses: [
            { ...RIVERSIDE, status: 'AVAILABLE' },
            { ...RETIRED, status: 'AVAILABLE' },
          ],
          blockedWarehouses: [],
        },
      })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name, RETIRED.name)
  const dialog = await openBulkDialog(user)
  await user.type(within(dialog).getByRole('textbox'), 'Zone C reopened')
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('2 warehouses reactivated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Zone C reopened' })
})

test('reports each blocked warehouse with its own reason', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json({
        data: {
          updatedWarehouses: [{ ...RIVERSIDE, status: 'AVAILABLE' }],
          blockedWarehouses: [{ id: RETIRED.id, name: RETIRED.name, reason: 'ALREADY_AVAILABLE' }],
        },
      }),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name, RETIRED.name)
  const dialog = await openBulkDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText('1 warehouse reactivated; 1 warehouse unchanged'),
  ).toBeInTheDocument()
  expect(await screen.findByText(`${RETIRED.name}: already available`)).toBeInTheDocument()
})

// Unlike archiving's IN_USE, neither reactivation blocker becomes eligible on a retry, so the
// selection is cleared rather than narrowed. Keeping a blocked warehouse checked would be worse
// than useless here: the refresh brings it back as Available, and the toolbar would rebuild itself
// around it as an *archival* — offering to archive exactly what was asked to be reactivated.
test('clears the selection after a partial outcome instead of turning it into an archival', async () => {
  let listRequests = 0
  // The catalogue the refresh reads. An ALREADY_AVAILABLE refusal means the warehouse really is
  // available by then, so the submission moves it there — the exact state that used to rebuild the
  // toolbar around it as an archival.
  let catalogue = REACTIVATE_WAREHOUSES
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () => {
      listRequests += 1

      return HttpResponse.json({ data: catalogue })
    }),
    http.post(BULK_URL, () => {
      catalogue = [
        AVAILABLE,
        { ...RIVERSIDE, status: 'AVAILABLE' },
        { ...RETIRED, status: 'AVAILABLE' },
      ]

      return HttpResponse.json({
        data: {
          updatedWarehouses: [{ ...RIVERSIDE, status: 'AVAILABLE' }],
          blockedWarehouses: [{ id: RETIRED.id, name: RETIRED.name, reason: 'ALREADY_AVAILABLE' }],
        },
      })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name, RETIRED.name)
  const dialog = await openBulkDialog(user)
  const requestsBeforeSubmission = listRequests
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText('1 warehouse reactivated; 1 warehouse unchanged'),
  ).toBeInTheDocument()
  await waitFor(() => expect(listRequests).toBeGreaterThan(requestsBeforeSubmission))
  // Nothing stays checked. Keeping the refused warehouse would leave the bar reading "1 selected"
  // over a warehouse the refresh has just turned available — an archival of what was asked to be
  // reactivated.
  expect(screen.getByRole('toolbar', { name: 'Bulk warehouse actions' })).toHaveTextContent(
    '0 selected',
  )
})

test('reports an all-blocked submission as nothing changed', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json({
        data: {
          updatedWarehouses: [],
          blockedWarehouses: [
            { id: RIVERSIDE.id, name: RIVERSIDE.name, reason: 'ALREADY_AVAILABLE' },
            { id: RETIRED.id, reason: 'NOT_FOUND' },
          ],
        },
      }),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name, RETIRED.name)
  const dialog = await openBulkDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('2 warehouses unchanged')).toBeInTheDocument()
  expect(await screen.findByText(new RegExp(`${RETIRED.id}: not found`))).toBeInTheDocument()
})

test('reports a failed submission without claiming anything was reactivated', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
        { status: 500 },
      ),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name)
  const dialog = await openBulkDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Unable to reactivate warehouses')).toBeInTheDocument()
})

test('keeps an available warehouse out of a reactivation selection', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, RIVERSIDE.name)

  expect(
    screen.queryByRole('button', { name: `Select warehouse ${AVAILABLE.name}` }),
  ).not.toBeInTheDocument()
})

test('uses the archive wording when the selection is of available warehouses', async () => {
  mockWarehouses(undefined, REACTIVATE_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, AVAILABLE.name)

  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
})

test('defaults an empty selection to reactivation while the archived filter is active', async () => {
  mockWarehouses(undefined, [TWO_DOOR_ARCHIVED_WAREHOUSE])
  const user = userEvent.setup()
  renderWarehouses('/warehouses?status=archived')

  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  await user.click(
    await screen.findByRole('button', { name: `Select warehouse ${RIVERSIDE.name}` }),
  )

  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
})
