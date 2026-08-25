import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  ACTIVE_OPERATIONS_LEAD,
  API_BASE_URL,
  SUSPEND_AVAILABLE_TRUCKS,
  SUSPEND_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks, truckTab } from '../support/test-helpers'

const [AVAILABLE, SUSPENDED, ARCHIVED] = SUSPEND_TRUCKS

function mockDirectory(overrides: Parameters<typeof mockTrucks>[0] = {}) {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
    ...overrides,
  })
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, registration: string) {
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(await screen.findByRole('button', { name: `Actions for ${registration}` }))
}

function detailsPanel() {
  return screen.queryByRole('region', { hidden: true, name: 'Truck details' })
}

test('suspends a truck from its row without opening the detail pane', async () => {
  const user = userEvent.setup()
  let currentComplete = SUSPEND_TRUCKS
  let received: { comment: string | null } | null = null

  mockDirectory()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.post(`${API_BASE_URL}/api/v1/trucks/${AVAILABLE.id}/suspend`, async ({ request }) => {
      received = (await request.json()) as { comment: string | null }
      const suspended: TruckDto = {
        ...AVAILABLE,
        status: 'SUSPENDED',
        suspendedAt: '2026-08-25T09:00:00.000Z',
        suspensionComment: received.comment,
      }
      currentComplete = currentComplete.map((truck) =>
        truck.id === AVAILABLE.id ? suspended : truck,
      )
      return HttpResponse.json({ data: suspended })
    }),
  )

  renderTrucks()
  await openRowMenu(user, AVAILABLE.registration)
  await user.click(await screen.findByRole('menuitem', { name: 'Suspend' }))

  const dialog = await screen.findByRole('alertdialog')
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Comment (optional)' }),
    'Gearbox failure',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Suspend' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  await waitFor(() => expect(received).toEqual({ comment: 'Gearbox failure' }))
  await waitFor(() => expect(truckTab(/Suspended/)).toHaveTextContent('(2)'))
  // The whole point of the row menu: the truck was never selected.
  expect(detailsPanel()).not.toBeInTheDocument()
})

test('archives a truck from its row', async () => {
  const user = userEvent.setup()
  let archiveCalls = 0

  mockDirectory()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${AVAILABLE.id}/archive`, () => {
      archiveCalls += 1
      return HttpResponse.json({
        data: { ...AVAILABLE, status: 'ARCHIVED', archivedAt: '2026-08-25T09:00:00.000Z' },
      })
    }),
  )

  renderTrucks()
  await openRowMenu(user, AVAILABLE.registration)
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))

  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(archiveCalls).toBe(1)
  expect(detailsPanel()).not.toBeInTheDocument()
})

test('reactivates an archived truck from its row in the archived tab', async () => {
  const user = userEvent.setup()
  let reactivateCalls = 0

  mockDirectory()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${ARCHIVED.id}/reactivate`, () => {
      reactivateCalls += 1
      return HttpResponse.json({ data: { ...ARCHIVED, status: 'AVAILABLE' } })
    }),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(truckTab(/Archived/))
  await user.click(
    await screen.findByRole('button', { name: `Actions for ${ARCHIVED.registration}` }),
  )
  await user.click(await screen.findByRole('menuitem', { name: 'Reactivate' }))

  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(reactivateCalls).toBe(1)
})

test('opens the edit form for the truck the row menu belongs to', async () => {
  const user = userEvent.setup()

  mockDirectory()
  renderTrucks()
  await openRowMenu(user, AVAILABLE.registration)
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

  expect(await screen.findByRole('heading', { name: 'Edit truck' })).toBeInTheDocument()
  expect(await screen.findByRole('textbox', { name: 'Registration' })).toHaveValue(
    AVAILABLE.registration,
  )
})

test('opens the detail pane from the row menu', async () => {
  const user = userEvent.setup()

  mockDirectory()
  renderTrucks()
  await openRowMenu(user, AVAILABLE.registration)
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))

  const panel = await screen.findByRole('region', { hidden: true, name: 'Truck details' })
  expect(
    within(panel).getByRole('heading', { hidden: true, name: AVAILABLE.registration }),
  ).toBeInTheDocument()
})

test('offers a suspended truck View alone, since it carries no lifecycle action yet', async () => {
  const user = userEvent.setup()

  mockDirectory()
  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(truckTab(/Suspended/))
  await user.click(
    await screen.findByRole('button', { name: `Actions for ${SUSPENDED.registration}` }),
  )

  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent),
  ).toEqual(['View'])
})

test('offers an available truck the full set, view first', async () => {
  const user = userEvent.setup()

  mockDirectory()
  renderTrucks()
  await openRowMenu(user, AVAILABLE.registration)

  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent),
  ).toEqual(['View', 'Edit', 'Suspend', 'Archive'])
})

test('offers no row menu to a non-administrator', async () => {
  mockDirectory({ user: ACTIVE_OPERATIONS_LEAD })
  renderTrucks()

  await screen.findByRole('list', { name: 'Available trucks' })
  expect(
    screen.queryByRole('button', { name: `Actions for ${AVAILABLE.registration}` }),
  ).not.toBeInTheDocument()
})
