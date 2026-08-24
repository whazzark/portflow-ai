import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  BULK_AVAILABLE_TRUCKS,
  BULK_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('archives the selected trucks with one shared request', async () => {
  let requestBody: unknown
  let currentComplete = BULK_TRUCKS
  let currentAvailable = BULK_AVAILABLE_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/archive`, async ({ request }) => {
      requestBody = await request.json()
      const updated = BULK_AVAILABLE_TRUCKS.map((truck) => ({
        ...truck,
        status: 'ARCHIVED' as const,
        archivedAt: '2026-08-24T09:00:00.000Z',
        archivedByUserId: 'operations-admin-1',
        archivedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
        archiveComment: 'Fleet cleanup',
      }))
      currentComplete = [...currentComplete.filter((t) => t.status === 'ARCHIVED'), ...updated]
      currentAvailable = []
      return HttpResponse.json({ data: { updatedTrucks: updated, blockedTrucks: [] } })
    }),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all available trucks' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument(),
  )
  expect(screen.getByText('3 selected')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  const comment = within(dialog).getByRole('textbox', { name: 'Comment (optional)' })
  expect(comment).toHaveAttribute('maxlength', '1000')
  fireEvent.change(comment, { target: { value: 'Fleet cleanup' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => {
    expect(requestBody).toEqual({
      ids: BULK_AVAILABLE_TRUCKS.map((truck) => truck.id),
      comment: 'Fleet cleanup',
    })
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  })
  expect(await screen.findByText('No available trucks')).toBeInTheDocument()
})

test('clears the bulk selection from the floating action bar', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' }))

  expect(screen.getByRole('toolbar')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' })).not.toBeChecked()
})

test('does not open the truck details panel when selecting a truck', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' }))

  expect(screen.queryByRole('heading', { name: 'GG-701-PF' })).not.toBeInTheDocument()
})
