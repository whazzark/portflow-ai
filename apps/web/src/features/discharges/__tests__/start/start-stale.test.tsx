import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { buildStartProblem, startableDetail } from '../support/fixtures'
import {
  allowFormJourneyTime,
  type DischargeWriteAnswer,
  mockDischargeStart,
  renderDischargeDetail,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const refusal = (status: number, code: string): DischargeWriteAnswer => ({
  status,
  body: { error: { code, message: code } },
})

test.each([
  [409, 'E_DISCHARGE_NOT_PLANNED', 'This discharge has already started'],
  [404, 'E_DISCHARGE_NOT_FOUND', 'This discharge has already started'],
  [403, 'E_AUTHORIZATION_FAILURE', 'You are not allowed to start discharges'],
])('closes the review when the start answers %i %s', async (status, code, message) => {
  const detail = startableDetail()
  const state = mockDischargeStart({ detail, respondToStart: () => refusal(status, code) })
  renderDischargeDetail(detail.id)

  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
  const dialog = await screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })
  const confirm = within(dialog).getByRole('button', { name: 'Start discharge' })
  await waitFor(() => expect(confirm).toBeEnabled())
  const detailRequests = state.detailRequests
  if (code === 'E_DISCHARGE_NOT_PLANNED') {
    // Another tab started it: the refreshed detail is the active one.
    state.current = { ...state.current, status: 'ACTIVE', startedAt: '2026-10-04T05:47:00.000Z' }
  }

  fireEvent.click(confirm)

  expect(await screen.findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  if (code !== 'E_AUTHORIZATION_FAILURE') {
    await waitFor(() => expect(state.detailRequests).toBeGreaterThan(detailRequests))
  }
  if (code === 'E_DISCHARGE_NOT_PLANNED') {
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument(),
    )
  }
})

test.each([
  [409, 'E_DISCHARGE_NOT_PLANNED', 'This discharge has already started'],
  [404, 'E_DISCHARGE_NOT_FOUND', 'This discharge has already started'],
])('closes the review when the check answers %i %s', async (status, code, message) => {
  const detail = startableDetail()
  mockDischargeStart({ detail, respondToCheck: () => refusal(status, code) })
  renderDischargeDetail(detail.id)

  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

  expect(await screen.findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('checks again on opening, rather than trusting what the product lots read earlier', async () => {
  const detail = startableDetail()
  const state = mockDischargeStart({
    detail,
    // Another discharge takes a door once the product lots have read the check.
    respondToCheck: () =>
      state.checkRequests > 1
        ? {
            problems: [
              buildStartProblem({
                family: 'ACTIVE_DISCHARGE_CONFLICT',
                code: 'WAREHOUSE_DOOR_HELD',
                subject: { type: 'WAREHOUSE_DOOR', id: 'door-a1' },
                context: { type: 'PRODUCT_LOT', id: detail.productLots[0].id },
                holder: { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar' },
              }),
            ],
          }
        : { problems: [] },
  })
  renderDischargeTab(detail.id, 'product-lots')
  await screen.findByRole('region', { name: 'Product lots' })
  await waitFor(() => expect(state.checkRequests).toBe(1))

  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
  const dialog = await screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })

  // The earlier answer offers nothing: the review waits for its own.
  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeDisabled()
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'This discharge cannot start yet',
  )
  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeDisabled()
})
