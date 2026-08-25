import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  BULK_AVAILABLE_TRUCKS,
  BULK_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks, truckTab } from '../support/test-helpers'

test('reports unchanged trucks in a toast and allows retrying only those', async () => {
  const [first, second, third] = BULK_AVAILABLE_TRUCKS
  const requestBodies: Array<{ ids: string[] }> = []

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/archive`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      requestBodies.push(body)

      if (requestBodies.length === 1) {
        return HttpResponse.json({
          data: {
            updatedTrucks: [{ ...first, status: 'ARCHIVED', archiveComment: null }],
            blockedTrucks: [
              { id: second.id, registration: second.registration, reason: 'IN_USE' },
              { id: third.id, registration: third.registration, reason: 'ALREADY_ARCHIVED' },
            ],
          },
        })
      }

      return HttpResponse.json({
        data: {
          updatedTrucks: body.ids.map((id) => {
            const truck = BULK_AVAILABLE_TRUCKS.find((item) => item.id === id)
            return { ...truck, status: 'ARCHIVED', archiveComment: null }
          }),
          blockedTrucks: [],
        },
      })
    }),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all available trucks' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  expect(await screen.findByText('1 truck archived; 2 trucks unchanged')).toBeInTheDocument()
  expect(
    screen.getByText(
      `${second.registration} (used by an active or planned discharge), ${third.registration} (already archived)`,
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('2 selected')).toBeInTheDocument()
  // The toolbar frame itself stays compact: no permanent per-truck list, just the count and a
  // button that now offers to retry exactly the trucks the toast reported as unchanged.
  expect(screen.queryByText('Some trucks were unchanged')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Retry blocked trucks' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  await waitFor(() => {
    expect(requestBodies).toHaveLength(2)
  })
  expect(requestBodies[1]?.ids.sort()).toEqual([second.id, third.id].sort())
})

test('hides the retry toolbar for blocked trucks after leaving the available tab', async () => {
  const [first, second, third] = BULK_AVAILABLE_TRUCKS
  const user = userEvent.setup()

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/archive`, () =>
      HttpResponse.json({
        data: {
          updatedTrucks: [{ ...first, status: 'ARCHIVED', archiveComment: null }],
          blockedTrucks: [
            { id: second.id, registration: second.registration, reason: 'IN_USE' },
            { id: third.id, registration: third.registration, reason: 'ALREADY_ARCHIVED' },
          ],
        },
      }),
    ),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all available trucks' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  expect(await screen.findByRole('button', { name: 'Retry blocked trucks' })).toBeInTheDocument()

  await user.click(truckTab(/Archived/))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry blocked trucks' })).not.toBeInTheDocument(),
  )
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
})

test('reports every truck as unchanged and archives nothing when the whole selection is ineligible', async () => {
  const [, , third] = BULK_AVAILABLE_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/archive`, () =>
      HttpResponse.json({
        data: {
          updatedTrucks: [],
          blockedTrucks: [
            { id: third.id, registration: third.registration, reason: 'ALREADY_ARCHIVED' },
          ],
        },
      }),
    ),
  )

  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(
    within(list).getByRole('checkbox', { name: `Select truck ${third.registration}` }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  expect(await screen.findByText('1 truck unchanged')).toBeInTheDocument()
  expect(screen.getByText(`${third.registration} (already archived)`)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry blocked trucks' })).toBeInTheDocument()
})
