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
import { mockTrucks, queryTruckTab, renderTrucks, truckTab } from '../support/test-helpers'

const COMPANY_NAME = 'Atlantic Transport'

function details() {
  return screen.getByRole('region', { hidden: true, name: 'Truck details' })
}

async function openTruck(user: ReturnType<typeof userEvent.setup>, target: TruckDto, tab?: RegExp) {
  await screen.findByRole('list', { name: 'Available trucks' })
  if (tab) {
    await user.click(truckTab(tab))
  }
  await user.click(
    await screen.findByRole('button', { name: `${target.registration}, ${COMPANY_NAME}` }),
  )
}

test('suspends a truck with a comment and moves it to the suspended tab without a manual refresh', async () => {
  const user = userEvent.setup()
  const target = SUSPEND_TRUCKS[0]
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
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/suspend`, async ({ request }) => {
      received = (await request.json()) as { comment: string | null }
      const suspended: TruckDto = {
        ...target,
        status: 'SUSPENDED',
        suspendedAt: '2026-08-25T09:00:00.000Z',
        suspendedByUserId: 'operations-admin-1',
        suspendedBy: { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' },
        suspensionComment: received.comment,
      }
      currentComplete = currentComplete.map((truck) => (truck.id === target.id ? suspended : truck))
      currentAvailable = currentAvailable.filter((truck) => truck.id !== target.id)
      return HttpResponse.json({ data: suspended })
    }),
  )

  renderTrucks()
  await openTruck(user, target)

  await user.click(within(details()).getByRole('button', { name: 'Suspend truck' }))
  await user.type(
    await screen.findByLabelText('Comment (optional)'),
    'Gearbox failure, in the workshop',
  )
  await user.click(screen.getByRole('button', { name: 'Suspend' }))

  await waitFor(() => {
    expect(received).toEqual({ comment: 'Gearbox failure, in the workshop' })
  })
  await waitFor(() => {
    expect(truckTab(/Suspended/)).toHaveTextContent('(2)')
  })
  expect(truckTab(/Available/)).toHaveTextContent('(0)')
})

test('shows the suspension context and offers no lifecycle action for a suspended truck', async () => {
  const user = userEvent.setup()
  const target = SUSPEND_TRUCKS[1]

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await openTruck(user, target, /Suspended/)

  const panel = details()
  // The badge and the "Truck status" field both read "Suspended".
  expect(within(panel).getAllByText('Suspended').length).toBeGreaterThan(0)
  expect(within(panel).getByText('Suspension context')).toBeInTheDocument()
  expect(within(panel).getByText('Gearbox failure, awaiting workshop slot')).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Edit truck' })).not.toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Suspend truck' })).not.toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Archive truck' })).not.toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Reactivate truck' })).not.toBeInTheDocument()
  expect(within(panel).getByTestId('truck-suspended-notice')).toHaveTextContent(
    /returned to service/i,
  )
})

test('keeps the workspace on the suspended tab when a suspended truck is selected', async () => {
  const user = userEvent.setup()
  const target = SUSPEND_TRUCKS[1]

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await openTruck(user, target, /Suspended/)

  // Before the tri-state fix this bounced to the available tab, where the truck is not listed,
  // and the "selection no longer valid" effect then cleared it.
  await waitFor(() => {
    expect(truckTab(/Suspended/)).toHaveAttribute('aria-selected', 'true')
  })
  // The open details sheet marks the directory behind it aria-hidden.
  expect(
    await screen.findByRole('button', {
      name: `${target.registration}, ${COMPANY_NAME}`,
      hidden: true,
    }),
  ).toBeInTheDocument()
})

test('offers no selection or bulk toolbar in the suspended tab', async () => {
  const user = userEvent.setup()

  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(truckTab(/Suspended/))

  const list = await screen.findByRole('list', { name: 'Suspended trucks' })
  expect(within(list).queryByRole('checkbox')).not.toBeInTheDocument()
})

test('refreshes to the authoritative state when suspension is refused', async () => {
  const user = userEvent.setup()
  const target = SUSPEND_TRUCKS[0]
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
    http.post(`${API_BASE_URL}/api/v1/trucks/${target.id}/suspend`, () =>
      HttpResponse.json(
        {
          error: { code: 'E_TRUCK_ALREADY_SUSPENDED', message: 'Truck is already suspended' },
        },
        { status: 409 },
      ),
    ),
  )

  renderTrucks()
  await openTruck(user, target)
  const requestsBefore = completeRequests

  await user.click(within(details()).getByRole('button', { name: 'Suspend truck' }))
  await user.click(await screen.findByRole('button', { name: 'Suspend' }))

  expect(await screen.findByText(/Unable to suspend truck/)).toBeInTheDocument()
  await waitFor(() => {
    expect(completeRequests).toBeGreaterThan(requestsBefore)
  })
})

test('hides the suspended tab from non-administrators', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_LEAD,
    complete: SUSPEND_TRUCKS,
    available: SUSPEND_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  expect(queryTruckTab(/Suspended/)).not.toBeInTheDocument()
  expect(screen.queryByText('TT-802-PF')).not.toBeInTheDocument()
})
