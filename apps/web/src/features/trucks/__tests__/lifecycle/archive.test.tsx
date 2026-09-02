import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import { ACTIVE_OPERATIONS_ADMIN, API_BASE_URL, TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

function details() {
  return screen.getByRole('dialog', { hidden: true })
}

test('archives a truck with a comment and moves it to the archived tab without a manual refresh', async () => {
  const target = TRUCKS[0]
  let current: TruckDto = target
  let currentComplete = TRUCKS
  let currentAvailable = TRUCKS.filter((truck) => truck.status === 'AVAILABLE')

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/archive`, async ({ request }) => {
      const body = (await request.json()) as { comment: string | null }
      current = {
        ...current,
        status: 'ARCHIVED',
        archivedAt: '2026-08-24T09:00:00.000Z',
        archivedByUserId: 'operations-admin-1',
        archivedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
        archiveComment: body.comment,
      }
      currentComplete = currentComplete.map((truck) => (truck.id === current.id ? current : truck))
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json({ data: current })
    }),
  )

  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${target.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), {
    target: { value: 'Returned to the leasing company' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect((await within(details()).findAllByText('Archived')).length).toBeGreaterThan(0)
  expect(within(details()).getByText('Returned to the leasing company')).toBeInTheDocument()
})

test('archives a truck without a comment', async () => {
  const target = TRUCKS[0]
  let currentComplete = TRUCKS
  let currentAvailable = TRUCKS.filter((truck) => truck.status === 'AVAILABLE')

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/archive`, () => {
      const archived: TruckDto = {
        ...target,
        status: 'ARCHIVED',
        archivedAt: '2026-08-24T09:00:00.000Z',
        archiveComment: null,
      }
      currentComplete = currentComplete.map((truck) => (truck.id === target.id ? archived : truck))
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json({ data: archived })
    }),
  )

  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${target.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect((await within(details()).findAllByText('Archived')).length).toBeGreaterThan(0)
})

test('cancelling the confirmation dialog performs no mutation and leaves the truck available', async () => {
  const target = TRUCKS[0]
  let archiveCalls = 0
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/archive`, () => {
      archiveCalls += 1
      return HttpResponse.json({ data: target })
    }),
  )

  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${target.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(archiveCalls).toBe(0)
  expect(within(details()).getAllByText('Available').length).toBeGreaterThan(0)
})

test('shows a distinct in-use error and keeps the truck available', async () => {
  const target = TRUCKS[0]
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/archive`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_IN_USE',
            message: 'Truck is used by a planned or active discharge',
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${target.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Truck is used by a planned or active discharge'),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(details()).getAllByText('Available').length).toBeGreaterThan(0)
})

test('shows a distinct already-archived error and refreshes to the authoritative archived state', async () => {
  const target = TRUCKS[0]
  let currentComplete = TRUCKS
  let currentAvailable = TRUCKS.filter((truck) => truck.status === 'AVAILABLE')

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/archive`, () => {
      currentComplete = currentComplete.map((truck) =>
        truck.id === target.id
          ? {
              ...truck,
              status: 'ARCHIVED',
              archivedAt: '2026-08-24T09:00:00.000Z',
              archivedByUserId: 'operations-admin-1',
              archivedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
              archiveComment: 'Archived by another admin',
            }
          : truck,
      )
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json(
        { error: { code: 'E_TRUCK_ALREADY_ARCHIVED', message: 'Truck is already archived' } },
        { status: 409 },
      )
    }),
  )

  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${target.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Truck is already archived')).toBeInTheDocument()
  expect(await within(details()).findByText('Archived by another admin')).toBeInTheDocument()
})

test('retrying after a transient failure archives the truck exactly once', async () => {
  const target = TRUCKS[0]
  let attempts = 0
  let currentComplete = TRUCKS
  let currentAvailable = TRUCKS.filter((truck) => truck.status === 'AVAILABLE')

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/archive`, () => {
      attempts += 1
      if (attempts === 1) {
        return HttpResponse.json(
          { error: { code: 'E_INTERNAL', message: 'Try again' } },
          { status: 500 },
        )
      }
      const archived: TruckDto = {
        ...target,
        status: 'ARCHIVED',
        archivedAt: '2026-08-24T09:00:00.000Z',
        archiveComment: null,
      }
      currentComplete = currentComplete.map((truck) => (truck.id === target.id ? archived : truck))
      currentAvailable = currentComplete.filter((truck) => truck.status === 'AVAILABLE')
      return HttpResponse.json({ data: archived })
    }),
  )

  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${target.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))
  await screen.findByText('Try again')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect((await within(details()).findAllByText('Archived')).length).toBeGreaterThan(0)
  expect(attempts).toBe(2)
})
