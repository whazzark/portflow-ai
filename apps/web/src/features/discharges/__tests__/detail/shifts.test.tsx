import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeDetail } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

function renderShifts(overrides: Partial<DischargeDetailDto>) {
  mockDischargeDetail({ details: [buildDischargeDetail(OCEAN_CEDAR, overrides)] })
  renderDischargeDetail(OCEAN_CEDAR.id)

  return screen.findByRole('region', { name: 'Shifts' })
}

test('lists shifts in planned order, each with its period, status, and responsible', async () => {
  const region = await renderShifts({
    shifts: [
      buildShift({ id: 'first', status: 'COMPLETED' }),
      buildShift({
        id: 'second',
        plannedEndAt: '2026-10-04T22:00:00.000Z',
        plannedStartAt: '2026-10-04T14:30:00.000Z',
        responsible: { id: 'lead-2', firstName: 'Hugo', lastName: 'Bernard' },
        status: 'ACTIVE',
      }),
    ],
  })

  const shifts = within(region).getAllByRole('article')
  expect(shifts).toHaveLength(2)
  expect(shifts[0]).toHaveAccessibleName(
    `Shift ${formatDateTime('2026-10-04T06:00:00.000Z')} – ${formatDateTime('2026-10-04T14:00:00.000Z')}`,
  )
  expect(shifts[0]).toHaveTextContent('Completed')
  expect(shifts[0]).toHaveTextContent('Léa Martin')
  expect(shifts[1]).toHaveTextContent('Active')
  expect(shifts[1]).toHaveTextContent('Hugo Bernard')
})

test('shows the trucks, doors, and weighing areas of a shift with their periods', async () => {
  const region = await renderShifts({
    shifts: [
      buildShift({
        trucks: [
          {
            id: 'truck-ended',
            truckId: 'truck-2',
            registration: 'EF-456-GH',
            truckStatus: 'AVAILABLE',
            effectiveFrom: '2026-10-04T06:00:00.000Z',
            effectiveTo: '2026-10-04T09:00:00.000Z',
          },
          {
            id: 'truck-open',
            truckId: 'truck-1',
            registration: 'AB-123-CD',
            truckStatus: 'SUSPENDED',
            effectiveFrom: '2026-10-04T06:00:00.000Z',
            effectiveTo: null,
          },
        ],
        warehouseDoors: [buildDoorPeriod()],
        weighingAreas: [
          {
            id: 'weighing-open',
            effectiveFrom: '2026-10-04T06:00:00.000Z',
            effectiveTo: null,
            weighingArea: { id: 'area-1', name: 'Pont-bascule Nord', status: 'ARCHIVED' },
          },
        ],
      }),
    ],
  })

  const trucks = within(region).getByRole('list', { name: 'Trucks' })
  const doors = within(region).getByRole('list', { name: 'Warehouse doors' })
  const areas = within(region).getByRole('list', { name: 'Weighing areas' })
  const truckItems = within(trucks).getAllByRole('listitem')
  // In effect first, then ended.
  expect(truckItems[0]).toHaveTextContent('AB-123-CD')
  expect(truckItems[0]).toHaveTextContent('Suspended')
  expect(truckItems[1]).toHaveTextContent('EF-456-GH')
  expect(truckItems[1]).toHaveTextContent('Ended')
  expect(within(doors).getByRole('listitem')).toHaveTextContent('Magasin A › Door A1')
  expect(within(areas).getByRole('listitem')).toHaveTextContent('Pont-bascule Nord')
  expect(within(areas).getByRole('listitem')).toHaveTextContent('Archived')
})

test('says which kinds of resource a shift has none of yet', async () => {
  const region = await renderShifts({ shifts: [buildShift()] })

  const shift = within(region).getByRole('article')
  expect(within(shift).getAllByText('None selected')).toHaveLength(3)
  expect(within(shift).queryByRole('list')).not.toBeInTheDocument()
})

test('says so when the discharge has no shift', async () => {
  const region = await renderShifts({ shifts: [] })

  expect(within(region).getByText('No shifts planned')).toBeInTheDocument()
  expect(within(region).queryByRole('article')).not.toBeInTheDocument()
})

test("shows a closed discharge's shift resources left without an end as ended", async () => {
  const region = await renderShifts({
    status: 'CLOSED',
    shifts: [buildShift({ status: 'COMPLETED', warehouseDoors: [buildDoorPeriod()] })],
  })

  const door = within(within(region).getByRole('list', { name: 'Warehouse doors' })).getByRole(
    'listitem',
  )
  expect(door).toHaveTextContent('Ended')
  expect(door).toHaveTextContent('end not recorded')
  expect(door).not.toHaveTextContent('Since')
})
