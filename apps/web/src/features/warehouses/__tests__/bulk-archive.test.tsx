import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, BULK_WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH = BULK_WAREHOUSES[0]
const EAST = BULK_WAREHOUSES[1]
const WEST = BULK_WAREHOUSES[2]
const BULK_URL = `${API_BASE_URL}/api/v1/warehouses/archive`

async function checkWarehouses(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  for (const name of names) {
    await user.click(await screen.findByRole('button', { name: `Select warehouse ${name}` }))
  }
}

async function openBulkDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Archive selected' }))

  return screen.findByRole('alertdialog')
}

test('sums the doors of the whole selection in the confirmation', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  // North holds 2 doors (one already archived), East holds 2, West holds none.
  await checkWarehouses(user, NORTH.name, EAST.name, WEST.name)
  const dialog = await openBulkDialog(user)

  expect(dialog).toHaveTextContent('3 warehouses')
  expect(dialog).toHaveTextContent('Their 4 doors are archived with them')
})

test('archives a fully eligible selection and reports the count', async () => {
  let capturedBody: unknown
  mockWarehouses(undefined, BULK_WAREHOUSES)
  server.use(
    http.post(BULK_URL, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: {
          updatedWarehouses: [
            { ...NORTH, status: 'ARCHIVED' },
            { ...EAST, status: 'ARCHIVED' },
          ],
          blockedWarehouses: [],
        },
      })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name)
  const dialog = await openBulkDialog(user)
  await user.type(within(dialog).getByRole('textbox'), 'End-of-campaign cleanup')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('2 warehouses archived')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({
    ids: [NORTH.id, EAST.id],
    comment: 'End-of-campaign cleanup',
  })
})

test('names each unchanged warehouse and its own reason on a partial outcome', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json({
        data: {
          updatedWarehouses: [{ ...NORTH, status: 'ARCHIVED' }],
          blockedWarehouses: [
            { id: EAST.id, name: EAST.name, reason: 'IN_USE' },
            { id: WEST.id, name: WEST.name, reason: 'ALREADY_ARCHIVED' },
          ],
        },
      }),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name, WEST.name)
  const dialog = await openBulkDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('1 warehouse archived; 2 warehouses unchanged'),
  ).toBeInTheDocument()
  // The in-use wording names the door as the cause, not the warehouse itself.
  expect(
    await screen.findByText(
      `${EAST.name}: a door is used by an active or planned discharge, ${WEST.name}: already archived`,
    ),
  ).toBeInTheDocument()
})

test('reports an all-blocked selection as nothing changed', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json({
        data: {
          updatedWarehouses: [],
          blockedWarehouses: [
            { id: NORTH.id, name: NORTH.name, reason: 'IN_USE' },
            { id: EAST.id, name: EAST.name, reason: 'IN_USE' },
          ],
        },
      }),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name)
  const dialog = await openBulkDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('2 warehouses unchanged')).toBeInTheDocument()
})

// Only IN_USE is worth keeping checked: it is the one refusal an administrator can act on and
// retry. A warehouse the server reports as already archived never becomes archivable, and leaving
// it checked would mix the two lifecycle states in a selection that must stay homogeneous.
test('keeps only the retriable blocked warehouse checked after a mixed refusal', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json({
        data: {
          updatedWarehouses: [{ ...NORTH, status: 'ARCHIVED' }],
          blockedWarehouses: [
            { id: EAST.id, name: EAST.name, reason: 'IN_USE' },
            { id: WEST.id, name: WEST.name, reason: 'ALREADY_ARCHIVED' },
          ],
        },
      }),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name, WEST.name)
  await user.click(within(await openBulkDialog(user)).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('1 warehouse archived; 2 warehouses unchanged'),
  ).toBeInTheDocument()
  expect(await screen.findByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('retries only the blocked warehouses without reselecting them', async () => {
  const submissions: string[][] = []
  mockWarehouses(undefined, BULK_WAREHOUSES)
  server.use(
    http.post(BULK_URL, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      submissions.push(body.ids)

      return HttpResponse.json({
        data:
          submissions.length === 1
            ? {
                updatedWarehouses: [{ ...NORTH, status: 'ARCHIVED' }],
                blockedWarehouses: [{ id: EAST.id, name: EAST.name, reason: 'IN_USE' }],
              }
            : {
                updatedWarehouses: [{ ...EAST, status: 'ARCHIVED' }],
                blockedWarehouses: [],
              },
      })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name)
  await user.click(within(await openBulkDialog(user)).getByRole('button', { name: 'Archive' }))
  expect(await screen.findByText('1 warehouse archived; 1 warehouse unchanged')).toBeInTheDocument()

  // The selection has narrowed to exactly the blocked warehouse, ready to retry.
  expect(await screen.findByText('1 selected')).toBeInTheDocument()
  await user.click(within(await openBulkDialog(user)).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('1 warehouse archived')).toBeInTheDocument()
  expect(submissions).toEqual([[NORTH.id, EAST.id], [EAST.id]])
})

test('reports a failed submission and keeps the selection for a retry', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  server.use(
    http.post(BULK_URL, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_ERROR', message: 'Service temporarily unavailable' } },
        { status: 503 },
      ),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name)
  await user.click(within(await openBulkDialog(user)).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Unable to archive warehouses')).toBeInTheDocument()
  expect(screen.getByText('2 selected')).toBeInTheDocument()
})
