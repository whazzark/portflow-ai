import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  BULK_ARCHIVED_TRUCKS,
  BULK_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('reactivates the selected trucks with one shared request', async () => {
  let requestBody: unknown
  let currentComplete = BULK_TRUCKS
  let currentAvailable = BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE')

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: currentAvailable,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks/reactivate`, async ({ request }) => {
      requestBody = await request.json()
      const updated = BULK_ARCHIVED_TRUCKS.map((truck) => ({
        ...truck,
        status: 'AVAILABLE' as const,
        reactivatedAt: '2026-08-24T09:00:00.000Z',
        reactivatedByUserId: 'operations-admin-1',
        reactivatedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
        reactivationComment: 'Winter fleet back in service',
      }))
      currentComplete = [...currentComplete.filter((t) => t.status === 'AVAILABLE'), ...updated]
      currentAvailable = currentComplete.filter((t) => t.status === 'AVAILABLE')
      return HttpResponse.json({ data: { updatedTrucks: updated, blockedTrucks: [] } })
    }),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  within(list)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all archived trucks' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument(),
  )
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  const dialog = await screen.findByRole('alertdialog')
  const comment = within(dialog).getByRole('textbox', { name: 'Comment (optional)' })
  expect(comment).toHaveAttribute('maxlength', '1000')
  fireEvent.change(comment, { target: { value: 'Winter fleet back in service' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  await waitFor(() => {
    expect(requestBody).toEqual({
      ids: BULK_ARCHIVED_TRUCKS.map((truck) => truck.id),
      comment: 'Winter fleet back in service',
    })
    expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
  })
  expect(await screen.findByText('No archived trucks')).toBeInTheDocument()
})

test('clears the bulk selection from the floating action bar in the archived tab', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE'),
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck JJ-004-PF' }))

  expect(screen.getByRole('toolbar')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
  expect(within(list).getByRole('checkbox', { name: 'Select truck JJ-004-PF' })).not.toBeChecked()
})

test('does not open the truck details panel when selecting an archived truck', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE'),
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck JJ-004-PF' }))

  expect(screen.queryByRole('heading', { name: 'JJ-004-PF' })).not.toBeInTheDocument()
})
