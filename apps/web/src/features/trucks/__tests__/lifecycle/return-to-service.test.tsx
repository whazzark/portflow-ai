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

const COMPANY_NAME = 'Atlantic Transport'
const SUSPENDED_TRUCK = SUSPEND_TRUCKS[1]

function details() {
  return screen.getByRole('region', { hidden: true, name: 'Truck details' })
}

async function openSuspendedTruck(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(truckTab(/Suspended/))
  await user.click(
    await screen.findByRole('button', {
      name: `${SUSPENDED_TRUCK.registration}, ${COMPANY_NAME}`,
    }),
  )
}

test('returns a suspended truck to service and moves it to the available tab without a manual refresh', async () => {
  const user = userEvent.setup()
  let currentComplete = SUSPEND_TRUCKS
  let currentAvailable = SUSPEND_AVAILABLE_TRUCKS
  let received: { comment: string | null } | null = null

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
  })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(
      `${API_BASE_URL}/api/v1/trucks/${SUSPENDED_TRUCK.id}/return-to-service`,
      async ({ request }) => {
        received = (await request.json()) as { comment: string | null }
        const returned: TruckDto = {
          ...SUSPENDED_TRUCK,
          status: 'AVAILABLE',
          returnedToServiceAt: '2026-08-25T09:00:00.000Z',
          returnedToServiceByUserId: 'operations-admin-1',
          returnedToServiceBy: {
            id: 'operations-admin-1',
            firstName: 'Olivia',
            lastName: 'Observer',
          },
          returnToServiceComment: received.comment,
        }
        currentComplete = currentComplete.map((truck) =>
          truck.id === SUSPENDED_TRUCK.id ? returned : truck,
        )
        currentAvailable = [...currentAvailable, returned]
        return HttpResponse.json({ data: returned })
      },
    ),
  )

  renderTrucks()
  await openSuspendedTruck(user)

  await user.click(within(details()).getByRole('button', { name: 'Return to service' }))
  await user.type(
    await screen.findByLabelText('Comment (optional)'),
    'Gearbox replaced, roadworthy',
  )
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Return to service',
    }),
  )

  await waitFor(() => {
    expect(received).toEqual({ comment: 'Gearbox replaced, roadworthy' })
  })
  await waitFor(() => {
    expect(truckTab(/Suspended/)).toHaveTextContent('(0)')
  })
  expect(truckTab(/Available/)).toHaveTextContent('(2)')
})

test('shows the return context beside the suspension it ended', async () => {
  const user = userEvent.setup()
  const returned: TruckDto = {
    ...SUSPENDED_TRUCK,
    status: 'AVAILABLE',
    returnedToServiceAt: '2026-08-25T09:00:00.000Z',
    returnedToServiceByUserId: 'admin-1',
    returnedToServiceBy: { id: 'admin-1', firstName: 'Olivia', lastName: 'Observer' },
    returnToServiceComment: 'Gearbox replaced, roadworthy',
  }
  const complete = SUSPEND_TRUCKS.map((truck) =>
    truck.id === SUSPENDED_TRUCK.id ? returned : truck,
  )

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete,
    available: complete.filter((truck) => truck.status === 'AVAILABLE'),
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(
    await screen.findByRole('button', {
      name: `${SUSPENDED_TRUCK.registration}, ${COMPANY_NAME}`,
    }),
  )

  const panel = details()
  expect(within(panel).getByText('Return to service context')).toBeInTheDocument()
  expect(within(panel).getByText('Gearbox replaced, roadworthy')).toBeInTheDocument()
  // FR-013: the suspension it ended stays readable as history.
  expect(within(panel).getByText('Suspension context')).toBeInTheDocument()
  expect(within(panel).getByText('Gearbox failure, awaiting workshop slot')).toBeInTheDocument()
  // A returned truck is an ordinary available truck again.
  expect(within(panel).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Suspend' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('offers no return action to a non-administrator', async () => {
  const user = userEvent.setup()

  mockTrucks({
    user: ACTIVE_OPERATIONS_LEAD,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await openSuspendedTruck(user)

  const panel = details()
  expect(within(panel).getByText('Suspension context')).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Return to service' })).not.toBeInTheDocument()
})

test('explains a refused return and refreshes to the authoritative state', async () => {
  const user = userEvent.setup()
  let completeRequests = 0

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
    onCompleteRequest: () => {
      completeRequests += 1
    },
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${SUSPENDED_TRUCK.id}/return-to-service`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_TRANSPORT_COMPANY_ARCHIVED',
            message:
              'Truck transport company is archived; reactivate the transport company before making this truck available again',
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderTrucks()
  await openSuspendedTruck(user)
  const requestsBeforeRefusal = completeRequests

  await user.click(within(details()).getByRole('button', { name: 'Return to service' }))
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Return to service',
    }),
  )

  expect(
    await screen.findByText(
      'Truck transport company is archived; reactivate the transport company before making this truck available again',
    ),
  ).toBeInTheDocument()
  expect(
    await screen.findByText(`Unable to return to service truck “${SUSPENDED_TRUCK.registration}”`),
  ).toBeInTheDocument()
  await waitFor(() => {
    expect(completeRequests).toBeGreaterThan(requestsBeforeRefusal)
  })
})
