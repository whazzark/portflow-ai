import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { TruckDto } from '@/features/trucks/types'
import { ACTIVE_OBSERVER, ACTIVE_OPERATIONS_ADMIN, TRUCKS } from '../support/fixtures'
import {
  findTruckTab,
  mockTrucks,
  queryTruckTab,
  renderTrucks,
  truckTab,
} from '../support/test-helpers'

const SCALE_NAMED_COMPANY_ID = '10000000-0000-4000-8000-000000000999'

const scaleCompanies = [
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `Carrier ${String(index + 1).padStart(4, '0')}`,
    status: (index === 0 ? 'ARCHIVED' : 'AVAILABLE') as 'ARCHIVED' | 'AVAILABLE',
  })),
  { id: SCALE_NAMED_COMPANY_ID, name: 'Carrier 0999', status: 'AVAILABLE' as const },
]

const scaleTrucks: TruckDto[] = Array.from({ length: 1_000 }, (_, index) => {
  const archived = index % 4 === 0
  const ordinal = index + 1

  return {
    ...TRUCKS[0],
    id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
    registration: `SCALE-${String(ordinal).padStart(4, '0')}`,
    // Trucks share a small carrier pool, except the one asserted by name below. The subject here
    // is 1,000 trucks; giving each its own carrier would also make the workspace render a
    // 1,000-row transport-company directory beside them, which is a different scale question.
    transportCompanyId:
      ordinal === 999
        ? SCALE_NAMED_COMPANY_ID
        : `10000000-0000-4000-8000-${String((ordinal % 10) + 1).padStart(12, '0')}`,
    status: archived ? 'ARCHIVED' : 'AVAILABLE',
    archivedAt: archived ? '2026-07-20T14:32:11.000Z' : null,
    archivedByUserId: null,
    archivedBy: null,
    archiveComment: archived ? 'Scale archive' : null,
  }
})

const availableScaleTrucks = scaleTrucks.filter((truck) => truck.status === 'AVAILABLE')

// Administrators also render a selection checkbox per available row (up to 750 in this dataset),
// and the workspace renders the transport-company directory for the same 1,000 carriers beside it,
// which pushes jsdom rendering well past the default 5s budget; extend it rather than weaken the
// 1,000-truck assertions.
test('keeps 1,000-truck endpoint selection, lifecycle counts, and local search bounded', async () => {
  const user = userEvent.setup()
  let completeRequests = 0
  let availableRequests = 0
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: scaleTrucks,
    available: availableScaleTrucks,
    companies: scaleCompanies,
    onCompleteRequest: () => {
      completeRequests += 1
    },
    onAvailableRequest: () => {
      availableRequests += 1
    },
  })

  renderTrucks()
  expect(await findTruckTab('Available (750)')).toBeInTheDocument()
  expect(truckTab('Archived (250)')).toBeInTheDocument()
  expect(completeRequests).toBeGreaterThan(0)
  expect(availableRequests).toBe(0)
  const requestsBeforeSearch = completeRequests

  await user.type(screen.getByRole('textbox', { name: 'Search trucks' }), '0999')
  const availableList = screen.getByRole('list', { name: 'Available trucks' })
  expect(within(availableList).getAllByRole('listitem')).toHaveLength(1)
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

  renderTrucks('/transport-resources?truckStatus=archived')
  expect(await findTruckTab('Available (750)')).toBeInTheDocument()
  expect(queryTruckTab(/Archived/)).not.toBeInTheDocument()
  expect(completeRequests).toBe(0)
  expect(availableRequests).toBeGreaterThan(0)
}, 60_000)
