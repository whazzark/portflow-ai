import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { buildStartProblem, startableDetail } from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeStart,
  renderDischargeDetail,
} from '../support/test-helpers'

allowFormJourneyTime()

const CEDAR = { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar' }

async function openStart() {
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

  return screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })
}

test('lists what another active discharge holds, and offers no start until it is fixed', async () => {
  const detail = startableDetail()
  mockDischargeStart({
    detail,
    respondToCheck: () => ({
      problems: [
        buildStartProblem({
          family: 'ACTIVE_DISCHARGE_CONFLICT',
          code: 'TRUCK_HELD',
          subject: { type: 'TRUCK', id: 'truck-a' },
          holder: CEDAR,
        }),
      ],
    }),
  })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()
  const alert = await within(dialog).findByRole('alert')

  expect(alert).toHaveTextContent('This discharge cannot start yet')
  expect(alert).toHaveTextContent('1 problem to fix')
  // A conflict sits with its element, where it is fixed, naming the discharge holding it.
  const pool = within(dialog).getByRole('region', { name: 'Truck pool' })
  expect(pool).toHaveTextContent('Truck AA-100-AA held by MV Ocean Cedar')
  expect(within(pool).getByRole('link', { name: 'Open Truck pool' })).toBeInTheDocument()
  expect(within(pool).getByRole('link', { name: 'MV Ocean Cedar' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeDisabled()
})

test('follows a conflict to the discharge holding the resource', async () => {
  const detail = startableDetail()
  mockDischargeStart({
    detail,
    respondToCheck: () => ({
      problems: [
        buildStartProblem({
          family: 'ACTIVE_DISCHARGE_CONFLICT',
          code: 'DOCK_HELD',
          subject: { type: 'DOCK', id: detail.dock.id },
          holder: CEDAR,
        }),
      ],
    }),
  })
  const { router } = renderDischargeDetail(detail.id)

  const dialog = await openStart()
  fireEvent.click(await within(dialog).findByRole('link', { name: 'MV Ocean Cedar' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/discharges/discharge-cedar'))
  expect(screen.queryByRole('dialog', { name: 'Start MV Atlantic Dawn' })).not.toBeInTheDocument()
})

test('replaces the list with the problems a refused start reports, and focuses it', async () => {
  const detail = startableDetail()
  const state = mockDischargeStart({
    detail,
    respondToStart: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_DISCHARGE_START_REFUSED',
          message: 'This discharge cannot start yet',
          meta: {
            shiftId: 'shift-first',
            problems: [
              buildStartProblem({
                family: 'ACTIVE_DISCHARGE_CONFLICT',
                code: 'WAREHOUSE_DOOR_HELD',
                subject: { type: 'WAREHOUSE_DOOR', id: 'door-a1' },
                context: { type: 'PRODUCT_LOT', id: 'lot-wheat' },
                holder: CEDAR,
              }),
            ],
          },
        },
      },
    }),
  })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()
  const confirm = within(dialog).getByRole('button', { name: 'Start discharge' })
  await waitFor(() => expect(confirm).toBeEnabled())
  const detailRequests = state.detailRequests

  fireEvent.click(confirm)

  const alert = await within(dialog).findByRole('alert')
  await waitFor(() => expect(alert).toHaveFocus())
  // The folded review below has a Product lots region of its own.
  const [lots] = within(dialog).getAllByRole('region', { name: 'Product lots' })
  expect(lots).toHaveTextContent('Cargill France · Blé tendre')
  expect(lots).toHaveTextContent('Door Door A1 · Magasin A held by MV Ocean Cedar')
  expect(screen.getByRole('dialog', { name: 'Start MV Atlantic Dawn' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeDisabled()
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(detailRequests))
})
