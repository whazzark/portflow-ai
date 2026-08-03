import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { TruckDto } from '@/features/trucks/types'
import { ACTIVE_OBSERVER, ACTIVE_OPERATIONS_ADMIN, TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

const scaleTrucks: TruckDto[] = Array.from({ length: 1_000 }, (_, index) => {
  const archived = index % 4 === 0
  const ordinal = index + 1

  return {
    ...TRUCKS[0],
    id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
    registration: `SCALE-${String(ordinal).padStart(4, '0')}`,
    transportCompanyId: `10000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
    status: archived ? 'ARCHIVED' : 'AVAILABLE',
    archivedAt: archived ? '2026-07-20T14:32:11.000Z' : null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: archived ? 'Scale archive' : null,
  }
})

const availableScaleTrucks = scaleTrucks.filter((truck) => truck.status === 'AVAILABLE')

test('keeps 1,000-truck endpoint selection, lifecycle counts, and local search bounded', async () => {
  const user = userEvent.setup()
  let completeRequests = 0
  let availableRequests = 0
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: scaleTrucks,
    available: availableScaleTrucks,
    companies: scaleTrucks.map((truck, index) => ({
      id: truck.transportCompanyId,
      name: `Carrier ${String(index + 1).padStart(4, '0')}`,
      status: index % 10 === 0 ? 'ARCHIVED' : 'AVAILABLE',
    })),
    onCompleteRequest: () => {
      completeRequests += 1
    },
    onAvailableRequest: () => {
      availableRequests += 1
    },
  })

  renderTrucks()
  expect(await screen.findByRole('tab', { name: 'Available (750)' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Archived (250)' })).toBeInTheDocument()
  expect(completeRequests).toBeGreaterThan(0)
  expect(availableRequests).toBe(0)
  const requestsBeforeSearch = completeRequests

  await user.type(screen.getByRole('textbox', { name: 'Search trucks' }), '0999')
  const availableList = screen.getByRole('list', { name: 'Available trucks' })
  expect(within(availableList).getAllByRole('button')).toHaveLength(1)
  expect(
    within(availableList).getByRole('button', { name: 'SCALE-0999, Carrier 0999' }),
  ).toBeInTheDocument()
  expect(completeRequests).toBe(requestsBeforeSearch)

  cleanup()
  completeRequests = 0
  availableRequests = 0
  mockTrucks({
    user: ACTIVE_OBSERVER,
    complete: scaleTrucks,
    available: availableScaleTrucks,
    onCompleteRequest: () => {
      completeRequests += 1
    },
    onAvailableRequest: () => {
      availableRequests += 1
    },
  })

  renderTrucks('/transport-resources?resource=trucks&truckStatus=archived')
  expect(await screen.findByRole('tab', { name: 'Available (750)' })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /Archived/ })).not.toBeInTheDocument()
  expect(completeRequests).toBe(0)
  expect(availableRequests).toBeGreaterThan(0)
})
