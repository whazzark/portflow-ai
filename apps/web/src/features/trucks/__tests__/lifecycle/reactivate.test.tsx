import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  REACTIVATE_AVAILABLE_TRUCKS,
  REACTIVATE_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks, truckTab } from '../support/test-helpers'

function details() {
  return screen.getByRole('region', { hidden: true, name: 'Truck details' })
}

async function openArchivedTruck(
  user: ReturnType<typeof userEvent.setup>,
  target: TruckDto,
  companyName = 'Atlantic Transport',
) {
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(truckTab(/Archived/))
  await user.click(
    await screen.findByRole('button', { name: `${target.registration}, ${companyName}` }),
  )
}

test('reactivates a truck with a comment and moves it to the available tab without a manual refresh', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[1]
  let currentComplete = REACTIVATE_TRUCKS
  let currentAvailable = REACTIVATE_AVAILABLE_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, async ({ request }) => {
      const body = (await request.json()) as { comment: string | null }
      const reactivated: TruckDto = {
        ...target,
        status: 'AVAILABLE',
        reactivatedAt: '2026-08-24T09:00:00.000Z',
        reactivatedByUserId: 'operations-admin-1',
        reactivatedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
        reactivationComment: body.comment,
      }
      currentComplete = currentComplete.map((truck) =>
        truck.id === target.id ? reactivated : truck,
      )
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json({ data: reactivated })
    }),
  )

  renderTrucks()
  await openArchivedTruck(user, target)

  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), {
    target: { value: 'Back from the gearbox overhaul' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect((await within(details()).findAllByText('Available')).length).toBeGreaterThan(0)
  expect(within(details()).getByText('Back from the gearbox overhaul')).toBeInTheDocument()
})

test('reactivates a truck without a comment', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[1]
  let currentComplete = REACTIVATE_TRUCKS
  let currentAvailable = REACTIVATE_AVAILABLE_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, () => {
      const reactivated: TruckDto = {
        ...target,
        status: 'AVAILABLE',
        reactivatedAt: '2026-08-24T09:00:00.000Z',
        reactivationComment: null,
      }
      currentComplete = currentComplete.map((truck) =>
        truck.id === target.id ? reactivated : truck,
      )
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json({ data: reactivated })
    }),
  )

  renderTrucks()
  await openArchivedTruck(user, target)
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect((await within(details()).findAllByText('Available')).length).toBeGreaterThan(0)
})

test('shows a distinct archived-transport-company error naming the remedy and keeps the truck archived', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[3]

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_TRANSPORT_COMPANY_ARCHIVED',
            message:
              'Truck transport company is archived; reactivate the company or reassign the truck before returning it to service',
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderTrucks()
  await openArchivedTruck(user, target, 'Coastal Haulage')
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText(
      'Truck transport company is archived; reactivate the company or reassign the truck before returning it to service',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(details()).getAllByText('Archived').length).toBeGreaterThan(0)
})

test('shows a distinct already-available error and refreshes to the authoritative available state', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[1]
  let currentComplete = REACTIVATE_TRUCKS
  let currentAvailable = REACTIVATE_AVAILABLE_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, () => {
      currentComplete = currentComplete.map((truck) =>
        truck.id === target.id
          ? {
              ...truck,
              status: 'AVAILABLE',
              reactivatedAt: '2026-08-24T09:00:00.000Z',
              reactivatedByUserId: 'operations-admin-1',
              reactivatedBy: {
                id: 'operations-admin-1',
                firstName: 'Olivia',
                lastName: 'Observer',
              },
              reactivationComment: 'Reactivated by another admin',
            }
          : truck,
      )
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json(
        { error: { code: 'E_TRUCK_ALREADY_AVAILABLE', message: 'Truck is already available' } },
        { status: 409 },
      )
    }),
  )

  renderTrucks()
  await openArchivedTruck(user, target)
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Truck is already available')).toBeInTheDocument()
  expect(await within(details()).findByText('Reactivated by another admin')).toBeInTheDocument()
})

test('rejects an overlong comment before submitting', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[1]
  let reactivateCalls = 0

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, () => {
      reactivateCalls += 1
      return HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            message: 'The comment field must not have more than 1000 characters',
            details: [],
          },
        },
        { status: 422 },
      )
    }),
  )

  renderTrucks()
  await openArchivedTruck(user, target)
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), {
    target: { value: 'a'.repeat(1001) },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText('The comment field must not have more than 1000 characters'),
  ).toBeInTheDocument()
  expect(reactivateCalls).toBe(1)
})

test('retrying after a transient failure reactivates the truck exactly once', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[1]
  let attempts = 0
  let currentComplete = REACTIVATE_TRUCKS
  let currentAvailable = REACTIVATE_AVAILABLE_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, () => {
      attempts += 1
      if (attempts === 1) {
        return HttpResponse.json(
          { error: { code: 'E_INTERNAL', message: 'Try again' } },
          { status: 500 },
        )
      }
      const reactivated: TruckDto = {
        ...target,
        status: 'AVAILABLE',
        reactivatedAt: '2026-08-24T09:00:00.000Z',
        reactivationComment: null,
      }
      currentComplete = currentComplete.map((truck) =>
        truck.id === target.id ? reactivated : truck,
      )
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json({ data: reactivated })
    }),
  )

  renderTrucks()
  await openArchivedTruck(user, target)
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))
  await screen.findByText('Try again')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect((await within(details()).findAllByText('Available')).length).toBeGreaterThan(0)
  expect(attempts).toBe(2)
})

test('cancelling the confirmation dialog performs no mutation and leaves the truck archived', async () => {
  const user = userEvent.setup()
  const target = REACTIVATE_TRUCKS[1]
  let reactivateCalls = 0

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: REACTIVATE_TRUCKS,
    available: REACTIVATE_AVAILABLE_TRUCKS,
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/reactivate`, () => {
      reactivateCalls += 1
      return HttpResponse.json({ data: target })
    }),
  )

  renderTrucks()
  await openArchivedTruck(user, target)
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(reactivateCalls).toBe(0)
  expect(within(details()).getAllByText('Archived').length).toBeGreaterThan(0)
})
