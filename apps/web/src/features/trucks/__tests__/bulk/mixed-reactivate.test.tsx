import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  BULK_ARCHIVED_TRUCKS,
  BULK_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks, truckTab } from '../support/test-helpers'

test('reports unchanged trucks in a toast and allows retrying only those', async () => {
  const [first, second] = BULK_ARCHIVED_TRUCKS
  const requestBodies: Array<{ ids: string[] }> = []

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE'),
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/reactivate`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      requestBodies.push(body)

      if (requestBodies.length === 1) {
        return HttpResponse.json({
          data: {
            updatedTrucks: [{ ...first, status: 'AVAILABLE', reactivationComment: null }],
            blockedTrucks: [
              {
                id: second.id,
                registration: second.registration,
                reason: 'TRANSPORT_COMPANY_ARCHIVED',
              },
            ],
          },
        })
      }

      return HttpResponse.json({
        data: {
          updatedTrucks: body.ids.map((id) => {
            const truck = BULK_ARCHIVED_TRUCKS.find((item) => item.id === id)
            return { ...truck, status: 'AVAILABLE', reactivationComment: null }
          }),
          blockedTrucks: [],
        },
      })
    }),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(truckTab(/Archived/))
  await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all archived trucks' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  expect(await screen.findByText('1 truck reactivated; 1 truck unchanged')).toBeInTheDocument()
  expect(screen.getByText(`${second.registration}: archived transport company`)).toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  await waitFor(() => {
    expect(requestBodies).toHaveLength(2)
  })
  expect(requestBodies[1]?.ids).toEqual([second.id])
})

test('hides the retry toolbar for blocked trucks after leaving the archived tab', async () => {
  const [first, second] = BULK_ARCHIVED_TRUCKS
  const user = userEvent.setup()

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE'),
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/reactivate`, () =>
      HttpResponse.json({
        data: {
          updatedTrucks: [{ ...first, status: 'AVAILABLE', reactivationComment: null }],
          blockedTrucks: [
            {
              id: second.id,
              registration: second.registration,
              reason: 'TRANSPORT_COMPANY_ARCHIVED',
            },
          ],
        },
      }),
    ),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(truckTab(/Archived/))
  await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all archived trucks' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  expect(await screen.findByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()

  await user.click(truckTab(/Available/))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument(),
  )
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
})

test('reports every truck as unchanged and reactivates nothing when the whole selection is ineligible', async () => {
  const [, second] = BULK_ARCHIVED_TRUCKS

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_TRUCKS.filter((truck) => truck.status === 'AVAILABLE'),
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/reactivate`, () =>
      HttpResponse.json({
        data: {
          updatedTrucks: [],
          blockedTrucks: [
            {
              id: second.id,
              registration: second.registration,
              reason: 'TRANSPORT_COMPANY_ARCHIVED',
            },
          ],
        },
      }),
    ),
  )

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(truckTab(/Archived/))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(
    within(list).getByRole('checkbox', { name: `Select truck ${second.registration}` }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  expect(await screen.findByText('1 truck unchanged')).toBeInTheDocument()
  expect(screen.getByText(`${second.registration}: archived transport company`)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
})
